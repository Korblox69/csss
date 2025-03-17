class CS2Client {
    constructor() {
        this.playerId = null;
        this.players = new Map();
        this.initScene();
        this.initNetwork();
        this.initUI();
        this.animate();
    }

    initUI() {
        this.shop = document.createElement('div');
        this.shop.id = 'shop';
        this.shop.innerHTML = `
            <h3>Weapons Shop ($<span id="money">0</span>)</h3>
            <div class="weapon" onclick="buyWeapon('pistol')">
                USP-S - $300 <button>Buy</button>
            </div>
            <div class="weapon" onclick="buyWeapon('rifle')">
                AK-47 - $2700 <button>Buy</button>
            </div>
            <div class="weapon" onclick="buyWeapon('awp')">
                AWP - $4750 <button>Buy</button>
            </div>
        `;
        document.body.appendChild(this.shop);
    }

    updateUI(player) {
        document.getElementById('money').textContent = player.money;
        this.shop.style.display = game.round.phase === 'buy' ? 'block' : 'none';
    }

    handleMessage(msg) {
        switch(msg.type) {
            case 'roundUpdate':
                document.getElementById('round-timer').textContent = msg.timer;
                document.getElementById('round-phase').textContent = msg.phase.toUpperCase();
                break;
            case 'playerUpdate':
                msg.players.forEach(p => {
                    this.updatePlayer(p);
                    if (p.id === this.playerId) this.updateUI(p);
                });
                break;
        }
    }
}

window.buyWeapon = (weapon) => {
    game.socket.send(JSON.stringify({ type: 'buy', weapon }));
};
