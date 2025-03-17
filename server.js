const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// Discord Webhook Configuration
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1350538405611831297/7kCExgLyhUB8bU03qk8YgkYfJkNuuPHcOGLA27ZL6YR9qrZswd0SqGfhUNo6t48WO8K';

async function sendDiscordMessage(content) {
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
    } catch (error) {
        console.error('Discord webhook error:', error);
    }
}

// Server Setup
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
    sendDiscordMessage('🔵 Server started');
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

// Game Constants
const WEAPONS = {
    pistol: { price: 300, damage: 25, range: 5 },
    rifle: { price: 2700, damage: 33, range: 8 },
    awp: { price: 4750, damage: 110, range: 15 }
};

class GameServer {
    constructor() {
        this.players = new Map();
        this.bomb = { planted: false, site: null, timer: 40 };
        this.round = {
            phase: 'waiting',
            timer: 0,
            number: 0,
            wins: { T: 0, CT: 0 }
        };
    }

    broadcast(type, data) {
        const msg = JSON.stringify({ type, ...data });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(msg);
        });
    }

    startBuyPhase() {
        this.round.phase = 'buy';
        this.round.timer = 20;
        this.round.number++;
        
        this.players.forEach(player => {
            player.money += player.survived ? 1400 : 0;
            player.survived = false;
            player.health = 100;
            player.weapons = ['knife'];
            player.position = player.team === 'T' ? [-50, 0, 50] : [50, 0, -50];
        });

        this.broadcast('roundUpdate', this.round);
        
        const interval = setInterval(() => {
            this.round.timer--;
            this.broadcast('roundUpdate', this.round);

            if (this.round.timer <= 0) {
                clearInterval(interval);
                this.startLivePhase();
            }
        }, 1000);
    }

    startLivePhase() {
        this.round.phase = 'live';
        this.round.timer = 115;
        this.broadcast('roundUpdate', this.round);

        const interval = setInterval(() => {
            this.round.timer--;
            this.broadcast('roundUpdate', this.round);

            if (this.round.timer <= 0) {
                clearInterval(interval);
                this.endRound('CT');
            }
        }, 1000);
    }

    endRound(winner) {
        this.round.phase = 'ended';
        this.round.wins[winner]++;
        
        this.players.forEach(player => {
            player.survived = player.health > 0;
            if (player.team === winner) {
                player.money += 3250;
                if (winner === 'T' && this.bomb.planted) player.money += 800;
            }
        });

        this.broadcast('roundEnd', { winner });
        setTimeout(() => this.startBuyPhase(), 10000);
        sendDiscordMessage(`🏆 ${winner} won round ${this.round.number}`);
    }
}

const game = new GameServer();

// WebSocket Handling
wss.on('connection', (ws) => {
    ws.id = uuidv4();
    ws.team = null;

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            const player = game.players.get(ws.id);
            
            switch(msg.type) {
                case 'join':
                    if (!/^[\w\d ]{3,15}$/.test(msg.name)) return;
                    
                    game.players.set(ws.id, {
                        id: ws.id,
                        name: msg.name,
                        team: msg.team,
                        money: 800,
                        health: 100,
                        weapons: ['knife'],
                        position: msg.team === 'T' ? [-50, 0, 50] : [50, 0, -50],
                        survived: false
                    });
                    ws.team = msg.team;
                    
                    await sendDiscordMessage(`${msg.name} joined as ${msg.team}`);
                    game.broadcast('playerUpdate', { players: Array.from(game.players.values()) });
                    if (game.round.phase === 'waiting') game.startBuyPhase();
                    break;

                case 'move':
                    if (game.round.phase !== 'live') return;
                    if (player && msg.position) {
                        player.position = msg.position;
                        game.broadcast('playerMoved', { id: ws.id, position: msg.position });
                    }
                    break;

                case 'buy':
                    if (game.round.phase !== 'buy') return;
                    const weapon = WEAPONS[msg.weapon];
                    if (weapon && player.money >= weapon.price) {
                        player.money -= weapon.price;
                        player.weapons.push(msg.weapon);
                        game.broadcast('playerUpdate', { players: Array.from(game.players.values()) });
                    }
                    break;

                case 'shoot':
                    if (game.round.phase !== 'live') return;
                    const attacker = game.players.get(ws.id);
                    const weaponType = attacker.weapons.find(w => w in WEAPONS) || 'pistol';
                    const weapon = WEAPONS[weaponType];
                    
                    game.players.forEach((target, id) => {
                        if (id !== ws.id && 
                            distance(attacker.position, target.position) < weapon.range &&
                            Math.random() < 0.7 // Accuracy factor
                        ) {
                            target.health -= weapon.damage;
                            if (target.health <= 0) {
                                attacker.money += 300;
                                sendDiscordMessage(`${attacker.name} killed ${target.name} with ${weaponType}`);
                                game.broadcast('kill', {
                                    killer: attacker.name,
                                    victim: target.name,
                                    weapon: weaponType
                                });
                            }
                            game.broadcast('playerUpdate', { players: Array.from(game.players.values()) });
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error('Message error:', error);
        }
    });

    ws.on('close', () => {
        game.players.delete(ws.id);
        game.broadcast('playerLeft', { id: ws.id });
    });
});

function distance(pos1, pos2) {
    return Math.sqrt(
        Math.pow(pos2[0] - pos1[0], 2) +
        Math.pow(pos2[2] - pos1[2], 2)
    );
}
