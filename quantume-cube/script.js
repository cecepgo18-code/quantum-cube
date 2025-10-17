class QuantumGame {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('quantumUsers')) || {};
        this.gameState = 'menu'; // menu, playing, paused, gameover
        this.init();
    }

    init() {
        this.setupAudio();
        this.setupAuthEvents();
        this.checkAutoLogin();
        this.setupGameEvents();
    }

    setupAudio() {
        this.bgMusic = document.getElementById('bgMusic');
        this.clickSound = document.getElementById('clickSound');
        this.gameOverSound = document.getElementById('gameOverSound');
        
        // Set volume
        this.bgMusic.volume = 0.3;
        this.clickSound.volume = 0.5;
        this.gameOverSound.volume = 0.5;
    }

    setupAuthEvents() {
        // Login events
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('registerBtn').addEventListener('click', () => this.register());
        document.getElementById('showRegisterBtn').addEventListener('click', () => this.showScreen('registerScreen'));
        document.getElementById('showLoginBtn').addEventListener('click', () => this.showScreen('loginScreen'));

        // Enter key support
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('confirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
    }

    setupGameEvents() {
        // Menu buttons
        document.getElementById('playBtn').addEventListener('click', () => this.startGame());
        document.getElementById('tutorialBtn').addEventListener('click', () => this.showTutorial());
        document.getElementById('shopMenuBtn').addEventListener('click', () => this.showShop());
        document.getElementById('settingsMenuBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('leaderboardMenuBtn').addEventListener('click', () => this.showLeaderboard());

        // Game controls
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());

        // Settings
        document.getElementById('soundToggle').addEventListener('change', (e) => this.toggleSound(e.target.checked));
        document.getElementById('musicToggle').addEventListener('change', (e) => this.toggleMusic(e.target.checked));
        document.getElementById('difficultySelect').addEventListener('change', (e) => {
            this.difficulty = e.target.value;
        });

        // Canvas click for game control
        document.getElementById('gameCanvas').addEventListener('click', () => {
            if (this.gameState === 'playing') {
                this.cubeThrust();
            }
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.gameState === 'playing') {
                this.cubeThrust();
            }
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.pauseGame();
            }
            if (e.code === 'Escape') {
                if (this.gameState === 'playing') this.pauseGame();
                else if (this.gameState === 'paused') this.resumeGame();
            }
        });
    }

    // Authentication Methods
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    checkAutoLogin() {
        const lastUser = localStorage.getItem('quantumLastUser');
        if (lastUser && this.users[lastUser]) {
            this.currentUser = lastUser;
            this.showGameScreen();
        }
    }

    login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showMessage('Please enter both username and password');
            return;
        }

        if (this.users[username] && this.users[username].password === password) {
            this.currentUser = username;
            localStorage.setItem('quantumLastUser', username);
            this.showGameScreen();
            this.showMessage(`Welcome back, Commander ${username}!`);
        } else {
            this.showMessage('Invalid username or password');
        }
    }

    register() {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !password) {
            this.showMessage('Please fill all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match');
            return;
        }

        if (username.length < 3) {
            this.showMessage('Username must be at least 3 characters');
            return;
        }

        if (this.users[username]) {
            this.showMessage('Username already exists');
            return;
        }

        // Create new user with default items
        this.users[username] = {
            password: password,
            highScore: 0,
            coins: 100,
            gamesPlayed: 0,
            totalScore: 0,
            playTime: 0,
            level: 1,
            unlockedCubes: ['default'],
            currentCube: 'default',
            unlockedTrails: ['default'],
            currentTrail: 'default',
            unlockedEffects: [],
            dailyStreak: 0,
            lastDaily: null,
            joinDate: new Date().toISOString()
        };

        localStorage.setItem('quantumUsers', JSON.stringify(this.users));
        this.currentUser = username;
        localStorage.setItem('quantumLastUser', username);
        this.showGameScreen();
        this.showMessage(`Welcome to the fleet, Commander ${username}!`);
    }

    showGameScreen() {
        this.showScreen('gameScreen');
        this.loadUserData();
        this.initGameEngine();
        this.playMusic();
    }

    loadUserData() {
        const user = this.users[this.currentUser];
        
        // Update UI
        document.getElementById('playerName').textContent = this.currentUser;
        document.getElementById('profileName').textContent = this.currentUser;
        document.getElementById('coins').textContent = user.coins;
        document.getElementById('playerLevel').textContent = user.level;
        document.getElementById('highScore').textContent = user.highScore;

        // Update cube avatar
        this.updateCubeAvatar();

        // Check daily reward availability
        this.checkDailyReward();
    }

    // Game Engine
    initGameEngine() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game settings
        this.difficulty = 'medium';
        this.setDifficulty();

        // Game state
        this.score = 0;
        this.gates = [];
        this.particles = [];
        this.frameCount = 0;
        this.gameTime = 0;

        // Initialize cube
        this.cube = {
            x: 80,
            y: this.canvas.height / 2,
            size: 30,
            velocity: 0,
            rotation: 0
        };

        this.showMenu();
    }

    setDifficulty() {
        const settings = {
            easy: { gateGap: 200, gateSpeed: 2, gateFrequency: 120, gravity: 0.4 },
            medium: { gateGap: 180, gateSpeed: 2.5, gateFrequency: 100, gravity: 0.5 },
            hard: { gateGap: 160, gateSpeed: 3, gateFrequency: 85, gravity: 0.6 }
        };

        const config = settings[this.difficulty];
        this.gateGap = config.gateGap;
        this.gateSpeed = config.gateSpeed;
        this.gateFrequency = config.gateFrequency;
        this.gravity = config.gravity;
        this.gateWidth = 70;
    }

    startGame() {
        this.gameState = 'playing';
        this.hideAllMenus();
        this.resetGame();
        this.gameLoop();
        this.playSound('click');
    }

    resetGame() {
        this.score = 0;
        this.gates = [];
        this.particles = [];
        this.frameCount = 0;
        this.gameTime = 0;

        this.cube = {
            x: 80,
            y: this.canvas.height / 2,
            size: 30,
            velocity: 0,
            rotation: 0
        };

        this.updateScore();
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;

        this.update();
        this.draw();
        
        this.frameCount++;
        this.gameTime += 1/60;

        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Apply gravity
        this.cube.velocity += this.gravity;
        this.cube.y += this.cube.velocity;
        this.cube.rotation = Math.max(-0.5, Math.min(0.5, this.cube.velocity * 0.05));

        // Generate gates
        if (this.frameCount % this.gateFrequency === 0) {
            this.generateGate();
        }

        // Update gates
        this.gates.forEach(gate => {
            gate.x -= this.gateSpeed;

            // Check if passed gate
            if (!gate.passed && gate.x + this.gateWidth < this.cube.x) {
                this.score++;
                this.updateScore();
                gate.passed = true;
                this.createParticles(gate.x + this.gateWidth, gate.y + gate.height / 2, 5);
                this.playSound('click');
            }
        });

        // Remove off-screen gates
        this.gates = this.gates.filter(gate => gate.x + this.gateWidth > 0);

        // Update particles
        this.particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });

        // Check collisions
        if (this.checkCollision()) {
            this.gameOver();
            return;
        }

        // Check boundaries
        if (this.cube.y <= 0) {
            this.cube.y = 0;
            this.cube.velocity = 0;
        }
        if (this.cube.y + this.cube.size >= this.canvas.height) {
            this.gameOver();
        }
    }

    draw() {
        // Clear canvas with space background
        this.ctx.fillStyle = '#050510';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stars
        this.drawStars();

        // Draw gates
        this.drawGates();

        // Draw particles
        this.drawParticles();

        // Draw cube
        this.drawCube();

        // Draw energy field (ground)
        this.drawEnergyField();
    }

    drawStars() {
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 137) % this.canvas.width;
            const y = (i * 97) % this.canvas.height;
            const size = Math.random() * 1.5 + 0.5;
            const alpha = Math.random() * 0.8 + 0.2;
            this.ctx.globalAlpha = alpha;
            this.ctx.fillRect(x, y, size, size);
        }
        this.ctx.globalAlpha = 1;
    }

    drawGates() {
        this.gates.forEach(gate => {
            // Gate body
            this.ctx.fillStyle = '#00f3ff';
            this.ctx.fillRect(gate.x, gate.y, gate.width, gate.height);

            // Gate edges with glow
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#ff00ff';
            this.ctx.fillRect(gate.x - 2, gate.y, 4, gate.height);
            this.ctx.fillRect(gate.x + gate.width - 2, gate.y, 4, gate.height);
            this.ctx.shadowBlur = 0;
        });
    }

    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.life / 30;
            this.ctx.fillRect(particle.x, particle.y, 3, 3);
        });
        this.ctx.globalAlpha = 1;
    }

    drawCube() {
        const user = this.users[this.currentUser];
        const cubeColor = this.getCubeColor(user.currentCube);

        this.ctx.save();
        this.ctx.translate(this.cube.x + this.cube.size / 2, this.cube.y + this.cube.size / 2);
        this.ctx.rotate(this.cube.rotation);

        // Cube body with gradient
        const gradient = this.ctx.createLinearGradient(
            -this.cube.size / 2, -this.cube.size / 2,
            this.cube.size / 2, this.cube.size / 2
        );
        gradient.addColorStop(0, cubeColor.primary);
        gradient.addColorStop(1, cubeColor.secondary);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(-this.cube.size / 2, -this.cube.size / 2, this.cube.size, this.cube.size);

        // Cube border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-this.cube.size / 2, -this.cube.size / 2, this.cube.size, this.cube.size);

        // Cube glow
        this.ctx.shadowColor = cubeColor.primary;
        this.ctx.shadowBlur = 20;
        this.ctx.fillRect(-this.cube.size / 2, -this.cube.size / 2, this.cube.size, this.cube.size);
        this.ctx.shadowBlur = 0;

        this.ctx.restore();

        // Draw trail based on user's current trail
        this.drawTrail();
    }

    drawTrail() {
        const user = this.users[this.currentUser];
        const trailColor = this.getTrailColor(user.currentTrail);

        for (let i = 0; i < 3; i++) {
            this.ctx.fillStyle = trailColor;
            this.ctx.globalAlpha = 0.3 - (i * 0.1);
            this.ctx.fillRect(
                this.cube.x - 10 - (i * 8),
                this.cube.y + (this.cube.size / 4),
                8,
                this.cube.size / 2
            );
        }
        this.ctx.globalAlpha = 1;
    }

    drawEnergyField() {
        // Bottom energy field
        const gradient = this.ctx.createLinearGradient(0, this.canvas.height - 20, 0, this.canvas.height);
        gradient.addColorStop(0, 'rgba(0, 243, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 0, 255, 0.6)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 20);

        // Energy pulses
        this.ctx.fillStyle = '#00ff88';
        this.ctx.globalAlpha = 0.5;
        const pulseWidth = (Math.sin(this.frameCount * 0.1) + 1) * 10 + 5;
        this.ctx.fillRect(this.canvas.width / 2 - pulseWidth / 2, this.canvas.height - 15, pulseWidth, 5);
        this.ctx.globalAlpha = 1;
    }

    generateGate() {
        const minHeight = 80;
        const maxHeight = this.canvas.height - this.gateGap - minHeight;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
        
        this.gates.push({
            x: this.canvas.width,
            y: 0,
            width: this.gateWidth,
            height: topHeight,
            passed: false
        });

        this.gates.push({
            x: this.canvas.width,
            y: topHeight + this.gateGap,
            width: this.gateWidth,
            height: this.canvas.height - topHeight - this.gateGap,
            passed: false
        });
    }

    createParticles(x, y, count) {
        const user = this.users[this.currentUser];
        const particleColor = this.getCubeColor(user.currentCube).primary;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30,
                color: particleColor
            });
        }
    }

    cubeThrust() {
        if (this.gameState === 'playing') {
            this.cube.velocity = -8;
            this.createParticles(this.cube.x, this.cube.y + this.cube.size / 2, 3);
            this.playSound('click');
        }
    }

    checkCollision() {
        // Check gate collisions
        for (let gate of this.gates) {
            if (this.cube.x < gate.x + gate.width &&
                this.cube.x + this.cube.size > gate.x &&
                this.cube.y < gate.y + gate.height &&
                this.cube.y + this.cube.size > gate.y) {
                return true;
            }
        }
        return false;
    }

    gameOver() {
        this.gameState = 'gameover';
        this.playSound('gameOver');

        const user = this.users[this.currentUser];
        
        // Calculate rewards
        const coinsEarned = Math.max(5, Math.floor(this.score / 2));
        user.coins += coinsEarned;
        user.totalScore += this.score;
        user.gamesPlayed++;
        user.playTime += Math.floor(this.gameTime);

        // Update high score
        if (this.score > user.highScore) {
            user.highScore = this.score;
        }

        // Level up based on total score
        user.level = Math.floor(user.totalScore / 1000) + 1;

        this.saveUserData();
        this.showGameOver(coinsEarned);
    }

    // UI Management
    showMenu() {
        this.gameState = 'menu';
        this.showOverlay('startMenu');
        this.updatePlayerInfo();
    }

    showTutorial() {
        this.showOverlay('tutorialScreen');
    }

    hideTutorial() {
        this.hideOverlay('tutorialScreen');
    }

    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.showOverlay('pauseMenu');
        }
    }

    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.hideAllMenus();
            this.gameLoop();
        }
    }

    restartGame() {
        this.startGame();
    }

    returnToMenu() {
        this.showMenu();
    }

    showGameOver(coinsEarned) {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalHighScore').textContent = this.users[this.currentUser].highScore;
        document.getElementById('earnedCoins').textContent = coinsEarned;
        this.showOverlay('gameOverScreen');
    }

    showOverlay(overlayId) {
        document.querySelectorAll('.overlay-menu').forEach(overlay => {
            overlay.classList.remove('active');
        });
        document.getElementById(overlayId).classList.add('active');
    }

    hideOverlay(overlayId) {
        document.getElementById(overlayId).classList.remove('active');
    }

    hideAllMenus() {
        document.querySelectorAll('.overlay-menu').forEach(overlay => {
            overlay.classList.remove('active');
        });
    }

    updateScore() {
        document.getElementById('currentScore').textContent = this.score;
    }

    updatePlayerInfo() {
        const user = this.users[this.currentUser];
        document.getElementById('coins').textContent = user.coins;
        document.getElementById('playerLevel').textContent = user.level;
        document.getElementById('highScore').textContent = user.highScore;
    }

    // Shop System
    showShop() {
        this.updateShop();
        this.showModal('shopModal');
    }

    updateShop() {
        const user = this.users[this.currentUser];
        document.getElementById('shopBalance').textContent = user.coins;
        this.loadShopItems();
    }

    loadShopItems() {
        const shopItems = document.getElementById('shopItems');
        const user = this.users[this.currentUser];

        const items = {
            cubes: [
                { id: 'neon', name: 'Neon Cube', price: 50, desc: 'Vibrant pink-blue energy', type: 'cube' },
                { id: 'crystal', name: 'Crystal Cube', price: 75, desc: 'Pure quantum crystal', type: 'cube' },
                { id: 'plasma', name: 'Plasma Cube', price: 100, desc: 'Living energy form', type: 'cube' }
            ],
            trails: [
                { id: 'fire', name: 'Fire Trail', price: 30, desc: 'Fiery exhaust trail', type: 'trail' },
                { id: 'spark', name: 'Spark Trail', price: 45, desc: 'Electric sparks', type: 'trail' },
                { id: 'rainbow', name: 'Rainbow Trail', price: 60, desc: 'Colorful energy stream', type: 'trail' }
            ],
            effects: [
                { id: 'shield', name: 'Energy Shield', price: 80, desc: 'Protective force field', type: 'effect' },
                { id: 'warp', name: 'Warp Effect', price: 120, desc: 'Space distortion', type: 'effect' }
            ]
        };

        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        const tabItems = items[activeTab] || [];

        shopItems.innerHTML = tabItems.map(item => {
            const owned = user.unlockedCubes.includes(item.id) || 
                         user.unlockedTrails.includes(item.id) || 
                         user.unlockedEffects.includes(item.id);
            const equipped = user.currentCube === item.id || user.currentTrail === item.id;

            return `
                <div class="shop-item">
                    <div class="item-preview ${item.id}"></div>
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>${item.desc}</p>
                    </div>
                    <button class="buy-btn ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}" 
                            onclick="quantumGame.purchaseItem('${item.id}', ${item.price}, '${item.type}')"
                            ${owned ? 'disabled' : ''}>
                        ${owned ? (equipped ? 'EQUIPPED' : 'OWNED') : item.price + ' CR'}
                    </button>
                </div>
            `;
        }).join('');

        // Add CSS for item previews
        this.addShopItemStyles();
    }

    addShopItemStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .item-preview { width: 50px; height: 50px; border-radius: 8px; border: 2px solid #00f3ff; }
            .item-preview.neon { background: linear-gradient(45deg, #ff00ff, #00ffff); }
            .item-preview.crystal { background: linear-gradient(45deg, #00ff88, #0088ff); }
            .item-preview.plasma { background: linear-gradient(45deg, #ff6b35, #f7931e); }
            .item-preview.fire { background: linear-gradient(45deg, #ff0000, #ffff00); }
            .item-preview.spark { background: linear-gradient(45deg, #00ffff, #ffffff); }
            .item-preview.rainbow { background: linear-gradient(45deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff); }
            .item-preview.shield { background: radial-gradient(circle, #00f3ff, transparent); border: 2px dashed #00f3ff; }
            .item-preview.warp { background: conic-gradient(from 0deg, #ff00ff, #00ffff, #ff00ff); }
            
            .buy-btn.equipped { background: #00ff88 !important; }
        `;
        document.head.appendChild(style);
    }

    purchaseItem(itemId, price, type) {
        const user = this.users[this.currentUser];

        if (user.coins < price) {
            this.showMessage('Not enough credits!');
            return;
        }

        user.coins -= price;

        switch(type) {
            case 'cube':
                user.unlockedCubes.push(itemId);
                user.currentCube = itemId;
                break;
            case 'trail':
                user.unlockedTrails.push(itemId);
                user.currentTrail = itemId;
                break;
            case 'effect':
                user.unlockedEffects.push(itemId);
                break;
        }

        this.saveUserData();
        this.updateShop();
        this.updatePlayerInfo();
        this.updateCubeAvatar();
        this.showMessage(`${itemId} purchased and equipped!`);
    }

    // Profile System
    showProfile() {
        const user = this.users[this.currentUser];
        
        document.getElementById('profileHighScore').textContent = user.highScore;
        document.getElementById('profileGames').textContent = user.gamesPlayed;
        document.getElementById('profileTime').textContent = Math.floor(user.playTime / 60) + 'm';
        document.getElementById('profileRank').textContent = this.calculateRank(user.highScore);

        this.showModal('profileModal');
    }

    calculateRank(score) {
        if (score >= 50) return 'Quantum Master';
        if (score >= 30) return 'Space Admiral';
        if (score >= 20) return 'Star Commander';
        if (score >= 10) return 'Space Cadet';
        return 'Rookie';
    }

    showNameEditor() {
        document.getElementById('newPlayerName').value = this.currentUser;
        this.showModal('nameEditorModal');
    }

    savePlayerName() {
        const newName = document.getElementById('newPlayerName').value.trim();
        
        if (!newName || newName.length < 3) {
            this.showMessage('Name must be at least 3 characters');
            return;
        }

        if (newName !== this.currentUser && this.users[newName]) {
            this.showMessage('Username already exists');
            return;
        }

        if (newName !== this.currentUser) {
            this.users[newName] = this.users[this.currentUser];
            delete this.users[this.currentUser];
            this.currentUser = newName;
            localStorage.setItem('quantumLastUser', newName);
        }

        this.saveUserData();
        this.loadUserData();
        this.hideModal('nameEditorModal');
        this.showMessage('Callsign updated!');
    }

    // Daily Reward System
    showDaily() {
        const user = this.users[this.currentUser];
        const today = new Date().toDateString();

        if (user.lastDaily === today) {
            this.showMessage('Daily reward already claimed!');
            return;
        }

        const reward = 50 + (user.dailyStreak * 10);
        document.getElementById('dailyReward').textContent = reward;
        document.getElementById('streakCount').textContent = user.dailyStreak;
        this.showModal('dailyModal');
    }

    claimDaily() {
        const user = this.users[this.currentUser];
        const today = new Date().toDateString();
        const reward = 50 + (user.dailyStreak * 10);

        // Check streak
        const lastClaim = user.lastDaily ? new Date(user.lastDaily) : null;
        const todayObj = new Date();
        
        if (lastClaim && lastClaim.toDateString() === todayObj.toDateString()) {
            this.showMessage('Reward already claimed today!');
            return;
        }

        // Check if consecutive day
        if (lastClaim) {
            const yesterday = new Date(todayObj);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastClaim.toDateString() === yesterday.toDateString()) {
                user.dailyStreak++;
            } else if (lastClaim.toDateString() !== todayObj.toDateString()) {
                user.dailyStreak = 1;
            }
        } else {
            user.dailyStreak = 1;
        }

        user.coins += reward;
        user.lastDaily = today;

        this.saveUserData();
        this.updatePlayerInfo();
        this.hideModal('dailyModal');
        this.showMessage(`Daily reward claimed! +${reward} credits (Streak: ${user.dailyStreak})`);
    }

    checkDailyReward() {
        const user = this.users[this.currentUser];
        const today = new Date().toDateString();
        const dailyBtn = document.querySelector('.nav-btn:nth-child(2)');

        if (user.lastDaily === today) {
            dailyBtn.style.opacity = '0.6';
        } else {
            dailyBtn.style.opacity = '1';
            dailyBtn.style.color = '#00ff88';
        }
    }

    // Settings
    showSettings() {
        this.showModal('settingsModal');
    }

    toggleSound(enabled) {
        this.clickSound.volume = enabled ? 0.5 : 0;
        this.gameOverSound.volume = enabled ? 0.5 : 0;
    }

    toggleMusic(enabled) {
        if (enabled) {
            this.playMusic();
        } else {
            this.bgMusic.pause();
        }
    }

    playMusic() {
        this.bgMusic.play().catch(e => {
            console.log('Audio play failed:', e);
        });
    }

    playSound(type) {
        if (type === 'click') {
            this.clickSound.currentTime = 0;
            this.clickSound.play().catch(e => console.log('Sound play failed'));
        } else if (type === 'gameOver') {
            this.gameOverSound.currentTime = 0;
            this.gameOverSound.play().catch(e => console.log('Sound play failed'));
        }
    }

    // Leaderboard
    showLeaderboard() {
        this.updateLeaderboard();
        this.showModal('leaderboardModal');
    }

    updateLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        const usersArray = Object.entries(this.users)
            .map(([username, data]) => ({ username, ...data }))
            .sort((a, b) => b.highScore - a.highScore)
            .slice(0, 10);

        leaderboardList.innerHTML = usersArray.map((user, index) => `
            <div class="leaderboard-item ${user.username === this.currentUser ? 'me' : ''}">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${user.username}</div>
                    <div class="leaderboard-score">${user.highScore} Energy</div>
                </div>
            </div>
        `).join('');
    }

    // Utility Methods
    getCubeColor(cubeType) {
        const colors = {
            default: { primary: '#00f3ff', secondary: '#ff00ff' },
            neon: { primary: '#ff00ff', secondary: '#00ffff' },
            crystal: { primary: '#00ff88', secondary: '#0088ff' },
            plasma: { primary: '#ff6b35', secondary: '#f7931e' }
        };
        return colors[cubeType] || colors.default;
    }

    getTrailColor(trailType) {
        const colors = {
            default: '#00f3ff',
            fire: '#ff6b35',
            spark: '#00ffff',
            rainbow: '#ff00ff'
        };
        return colors[trailType] || colors.default;
    }

    updateCubeAvatar() {
        const user = this.users[this.currentUser];
        const cubeColor = this.getCubeColor(user.currentCube);
        
        const avatars = document.querySelectorAll('.avatar-cube');
        avatars.forEach(avatar => {
            avatar.style.background = `linear-gradient(45deg, ${cubeColor.primary}, ${cubeColor.secondary})`;
        });
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showMessage(message) {
        // Simple alert for now - can be replaced with better UI
        alert(message);
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('quantumLastUser');
        this.showScreen('loginScreen');
        this.bgMusic.pause();
    }

    saveUserData() {
        localStorage.setItem('quantumUsers', JSON.stringify(this.users));
    }
}

// Initialize game when page loads
let quantumGame;
window.addEventListener('load', () => {
    quantumGame = new QuantumGame();
});