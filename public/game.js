class CS2Client {
    constructor() {
        this.playerId = null;
        this.players = new Map();
        this.keys = {};
        this.initScene();
        this.initNetwork();
        this.initControls();
        this.initUI();
        this.animate();
    }

    initScene() {
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas') });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        
        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x404040));

        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // Bomb sites
        this.createBombsite(-50, 0, 50);
        this.createBombsite(50, 0, -50);
    }

    createBombsite(x, y, z) {
        const geometry = new THREE.CylinderGeometry(5, 5, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
        const site = new THREE.Mesh(geometry, material);
        site.position.set(x, y, z);
        this.scene.add(site);
    }

    initNetwork() {
        this.socket = new WebSocket(`ws://${window.location.host}`);
        
        this.socket.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            switch(msg.type) {
                case 'playerUpdate':
                    msg.players.forEach(p => this.updatePlayer(p));
                    break;
                case 'playerMoved':
                    this.movePlayer(msg.id, msg.position);
                    break;
                case 'roundUpdate':
                    this.updateRoundUI(msg);
                    break;
                case 'kill':
                    this.killFeed.addEntry(`${msg.killer} killed ${msg.victim} (${msg.weapon})`);
                    break;
            }
        };
    }

    updatePlayer(data) {
        if (!this.players.has(data.id)) {
            const geometry = new THREE.CapsuleGeometry(0.3, 1.8);
            const material = new THREE.MeshBasicMaterial({ 
                color: data.team === 'T' ? 0xff4444 : 0x4444ff 
            });
            const model = new THREE.Mesh(geometry, material);
            this.scene.add(model);
            this.players.set(data.id, model);
            
            if (data.id === this.playerId) {
                this.camera.position.set(...data.position);
                this.camera.position.y += 1.6;
                this.camera.lookAt(0, 0, 0);
            }
        }
        
        const model = this.players.get(data.id);
        model.position.set(...data.position);
        if (data.id === this.playerId) {
            document.getElementById('health').textContent = data.health;
            document.getElementById('money').textContent = data.money;
        }
    }

    initUI() {
        // Shop
        this.shop = document.createElement('div');
        this.shop.id = 'shop';
        this.shop.innerHTML = `
            <h3>Weapons Shop ($<span id="money">0</span>)</h3>
            <div class="weapon" onclick="buyWeapon('pistol')">
                USP-S - $300
            </div>
            <div class="weapon" onclick="buyWeapon('rifle')">
                AK-47 - $2700
            </div>
            <div class="weapon" onclick="buyWeapon('awp')">
                AWP - $4750
            </div>
        `;
        document.body.appendChild(this.shop);

        // Round Info
        this.roundInfo = document.createElement('div');
        this.roundInfo.id = 'round-info';
        document.body.appendChild(this.roundInfo);

        // Health
        const healthBar = document.createElement('div');
        healthBar.id = 'health-bar';
        healthBar.innerHTML = 'HEALTH: <span id="health">100</span>';
        document.body.appendChild(healthBar);
    }

    updateRoundUI(round) {
        this.roundInfo.innerHTML = `
            Round ${round.number} | 
            Phase: ${round.phase.toUpperCase()} | 
            Time: ${round.timer}
        `;
        this.shop.style.display = round.phase === 'buy' ? 'block' : 'none';
    }

    initControls() {
        document.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        document.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        
        document.addEventListener('click', () => {
            if (this.playerId) {
                this.socket.send(JSON.stringify({ type: 'shoot' }));
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.playerId && this.players.has(this.playerId)) {
            const player = this.players.get(this.playerId);
            const speed = 0.1;
            
            const moveVector = new THREE.Vector3(
                (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0),
                0,
                (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0)
            ).normalize().multiplyScalar(speed);

            player.position.add(moveVector);
            this.camera.position.copy(player.position);
            this.camera.position.y += 1.6;

            this.socket.send(JSON.stringify({
                type: 'move',
                position: [player.position.x, player.position.y, player.position.z]
            }));
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

window.buyWeapon = (weapon) => {
    game.socket.send(JSON.stringify({ type: 'buy', weapon }));
};

new CS2Client();
