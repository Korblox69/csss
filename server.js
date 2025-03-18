const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

let players = {};
let bullets = [];
const BULLET_LIFETIME = 5000; // Bullet expires after 5 seconds

server.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    players[id] = { x: Math.random() * 500, y: Math.random() * 500, money: 100, health: 100 };

    // Send initial data to the new player
    ws.send(JSON.stringify({ type: 'init', id, players }));

    // Notify others
    broadcast({ type: 'playerJoin', id, player: players[id] });

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error("Invalid JSON received:", message);
            return; // Ignore invalid messages
        }

        if (data.type === 'move' && players[id]) {
            players[id].x = data.x;
            players[id].y = data.y;
            broadcast({ type: 'playerMove', id, x: data.x, y: data.y });
        }

        if (data.type === 'shoot' && players[id]) {
            const bullet = { id, x: data.x, y: data.y, timestamp: Date.now() };
            bullets.push(bullet);
            broadcast({ type: 'shoot', id, x: data.x, y: data.y });

            // Remove bullet after lifetime expires
            setTimeout(() => {
                bullets = bullets.filter(b => b !== bullet);
            }, BULLET_LIFETIME);
        }
    });

    ws.on('close', () => {
        delete players[id];
        broadcast({ type: 'playerLeave', id });
    });
});

function broadcast(data) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

console.log("Server running on ws://localhost:8080");
