// --- PERFORMANCE CACHE ---
const DOM = {
    termContent: document.getElementById('terminal-content'),
    termInput: document.getElementById('term-input'),
    healthFill: document.getElementById('health-fill'),
    healthPercent: document.getElementById('health-percent'),
    timer: document.getElementById('timer'),
    lvlTitle: document.querySelector(".level-title"),
    canvas: document.getElementById('gameCanvas'),
    bgGradient: document.querySelector(".bg-gradient"),
    mainContainer: document.querySelector(".container"),
    playLevels: document.querySelector(".play-levels"),
    settings: document.querySelector(".settings"),
    profileToggle: document.getElementById('profile-toggle'),
    logoutBtn: document.getElementById('top-logout-btn')
};

// --- API HELPER FUNCTION ---
const API_BASE = window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://control-error-neurobreak.onrender.com";

async function apiCall(endpoint, method = 'GET', body = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        };

        const savedSession = localStorage.getItem('pilot_session');
        if (savedSession) {
            const { access_token } = JSON.parse(savedSession);
            if (access_token) options.headers['Authorization'] = `Bearer ${access_token}`;
        }

        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        clearTimeout(timeoutId);

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return { data, error: null };
    } catch (err) {
        clearTimeout(timeoutId);
        let errorMsg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Connection failed');
        if (errorMsg.toLowerCase().includes('failed to fetch')) {
            errorMsg = "Connection Failed: Could not connect to backend server.";
        }
        console.error(`API Error (${endpoint}):`, errorMsg);
        return { data: null, error: { message: errorMsg } };
    }
}

// --- CUSTOM ALERT FUNCTION ---
function showCustomAlert(message, type = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    const msgEl = document.getElementById('custom-alert-message');
    if (!modal || !msgEl) return;

    msgEl.innerText = message;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
}

document.addEventListener('click', (e) => {
    if (e.target.closest('.close-alert') || e.target.id === 'custom-alert-ok' || e.target.id === 'custom-alert-modal') {
        const modal = document.getElementById('custom-alert-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        }
    }
});

// --- PASSWORD VISIBILITY ---
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-password');
    if (toggle) {
        const input = toggle.closest('.password-container').querySelector('input');
        input.type = input.type === 'password' ? 'text' : 'password';
        const icon = toggle.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
            lucide.createIcons();
        }
    }
});

// --- STATE MANAGEMENT ---
let currentUser = null;
let userAge = null;
let userSubjectPreferences = "";
let gameActive = false;
let isPaused = false;
let animationId = null;
let timerId = null;
let time = 300;
let enemiesSpawned = 0;
let currentMaxEnemies = 10;
let spawnInterval = null;
let puzzleInterval = null;

// --- LEVEL PERSISTENCE ---
function getUnlockedLevels() {
    const saved = localStorage.getItem('unlocked_levels');
    return saved ? JSON.parse(saved) : [1];
}

function saveUnlockedLevel(lvl) {
    let unlocked = getUnlockedLevels();
    if (!unlocked.includes(lvl)) {
        unlocked.push(lvl);
        localStorage.setItem('unlocked_levels', JSON.stringify(unlocked));
    }
}

function applyUnlockedLevelsUI() {
    const unlocked = getUnlockedLevels();
    const lvlNodes = document.querySelectorAll(".lvls");
    lvlNodes.forEach((node, index) => {
        const num = index + 1;
        if (unlocked.includes(num)) {
            node.classList.remove('locked');
            if (!node.innerText.trim() || node.querySelector('.lock-icon')) {
                node.innerText = num;
            }
        } else {
            node.classList.add('locked');
            if (!node.querySelector('.lock-icon')) {
                node.innerHTML = '<i data-lucide="lock" class="lock-icon"></i>';
                lucide.createIcons();
            }
        }
    });
}

// --- UI NAVIGATION ---
const showHomeUI = () => {
    if (DOM.profileToggle) DOM.profileToggle.style.display = "flex";
    if (DOM.logoutBtn) DOM.logoutBtn.style.display = "flex";
};

const hideHomeUI = () => {
    if (DOM.profileToggle) DOM.profileToggle.style.display = "none";
    if (DOM.logoutBtn) DOM.logoutBtn.style.display = "none";
    if (DOM.settings) DOM.settings.classList.remove("active");
};

document.querySelector(".play-card")?.addEventListener("click", () => {
    applyUnlockedLevelsUI();
    if (DOM.playLevels) DOM.playLevels.style.display = "block";
    if (DOM.bgGradient) DOM.bgGradient.style.display = "none";
    hideHomeUI();
});

document.querySelector(".rules-card")?.addEventListener("click", () => {
    if (DOM.mainContainer) DOM.mainContainer.style.display = "none";
    document.querySelector(".rules-page-cont").style.display = "block";
    hideHomeUI();
});

document.getElementById('rules-to-home')?.addEventListener("click", () => {
    if (DOM.mainContainer) DOM.mainContainer.style.display = "block";
    document.querySelector(".rules-page-cont").style.display = "none";
    showHomeUI();
});

document.querySelector(".back-btn-play-levels")?.addEventListener("click", () => {
    if (DOM.bgGradient) DOM.bgGradient.style.display = "flex";
    if (DOM.mainContainer) DOM.mainContainer.style.display = "block";
    if (DOM.playLevels) DOM.playLevels.style.display = "none";
    showHomeUI();
});

// --- TERMINAL LOGIC ---
function addMyText(text, className = '') {
    if (!DOM.termContent) return;
    const newLine = document.createElement('div');
    newLine.className = `terminal-msg ${className}`;
    newLine.textContent = text;
    DOM.termContent.appendChild(newLine);
    DOM.termContent.scrollTop = DOM.termContent.scrollHeight;
}

function clearTerminal() {
    if (DOM.termContent) DOM.termContent.innerHTML = '';
}

DOM.termInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = DOM.termInput.value.trim();
        if (val) {
            addMyText(`$ ${val}`, 'terminal-user');
            DOM.termInput.value = "";
            processCommand(val);
        }
    }
});

function processCommand(cmd) {
    if (!currentPuzzle) return;
    const isCorrect = cmd.toLowerCase() === currentPuzzle.answer.toLowerCase() ||
        cmd === (currentPuzzle.options.indexOf(currentPuzzle.answer) + 1).toString();

    if (isCorrect) {
        addMyText("✔ CORRECT. SYSTEMS OPTIMIZED.", 'terminal-success');
        resetControls();
        setTimeout(fetchNewPuzzle, 10000);
    } else {
        puzzleAttempts++;
        const section = document.querySelector('.terminal-section');
        section.classList.add('shake');
        setTimeout(() => section.classList.remove('shake'), 400);

        if (puzzleAttempts >= 2) {
            addMyText("❌ CRITICAL FAILURE. SYSTEM LOCKDOWN.", 'terminal-error');
            showGameModal('game-over-modal');
        } else {
            addMyText(`❌ INCORRECT. ${2 - puzzleAttempts} ATTEMPT REMAINING.`, 'terminal-warning');
        }
    }
}

// --- GAME CORE ---
const canvas = DOM.canvas;
const ctx = canvas?.getContext('2d');
let player, projectiles = [], enemyProjectiles = [], enemies = [], keys = {};
let mousePos = { x: 0, y: 0 }, lastFireTime = 0;
const FIRE_RATE = 200;

let controlMapping = { up: ['w', 'ArrowUp'], down: ['s', 'ArrowDown'], left: ['a', 'ArrowLeft'], right: ['d', 'ArrowRight'] };
const defaultControls = JSON.parse(JSON.stringify(controlMapping));
let currentPuzzle = null, puzzleAttempts = 0;

function randomizeControls() {
    const dirs = ['up', 'down', 'left', 'right'];
    const sets = [['w', 'ArrowUp'], ['s', 'ArrowDown'], ['a', 'ArrowLeft'], ['d', 'ArrowRight']];
    sets.sort(() => Math.random() - 0.5).forEach((s, i) => controlMapping[dirs[i]] = s);
    addMyText("⚠️ GLITCH DETECTED: CONTROLS RANDOMIZED!", 'terminal-warning');
}

function resetControls() {
    controlMapping = JSON.parse(JSON.stringify(defaultControls));
    addMyText("✅ baseline function Restored.", 'terminal-success');
    currentPuzzle = null;
}

async function fetchNewPuzzle() {
    if (!gameActive || isPaused) return;
    randomizeControls();
    const lvl = parseInt(DOM.lvlTitle.innerText.replace('Level ', '')) || 1;
    const { data } = await apiCall('/api/generate-puzzle', 'POST', {
        subjects: userSubjectPreferences || "General Science",
        level: lvl,
        age: userAge || 18
    });

    currentPuzzle = data || { question: "1 + 1?", options: ["1", "2", "3", "4"], answer: "2" };
    puzzleAttempts = 0;
    addMyText("🧩 NEURAL DECRYPTION REQUIRED", 'terminal-puzzle-header');
    addMyText(currentPuzzle.question, 'terminal-question');
    currentPuzzle.options.forEach((o, i) => addMyText(`${i + 1}. ${o}`, 'terminal-option'));
}

class Entity {
    constructor(x, y, radius, color) { Object.assign(this, { x, y, radius, color }); }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
    }
}

class PlayerEntity extends Entity {
    constructor(x, y) {
        super(x, y, 15, 'cyan');
        this.speed = 4; this.health = 100; this.shieldCycle = 0;
    }
    update() {
        const move = (dir, dx, dy) => { if (controlMapping[dir].some(k => keys[k])) { this.x += dx; this.y += dy; } };
        move('up', 0, -this.speed); move('down', 0, this.speed); move('left', -this.speed, 0); move('right', this.speed, 0);

        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        const now = Date.now();
        this.shieldActive = (now % 10000 < 5000);
        this.angle = Math.atan2(mousePos.y - this.y, mousePos.x - this.x);

        if (this.shieldActive) {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 12, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(45, 212, 191, ${0.3 + Math.sin(now / 150) * 0.2})`;
            ctx.lineWidth = 3; ctx.stroke();
        }
        this.draw();
        if (keys[' '] && now - lastFireTime > FIRE_RATE) {
            projectiles.push(new Projectile(this.x, this.y, Math.cos(this.angle) * 7, Math.sin(this.angle) * 7));
            lastFireTime = now;
        }
    }
}

class Projectile extends Entity {
    constructor(x, y, vx, vy) { super(x, y, 5, 'white'); this.vx = vx; this.vy = vy; }
    update() { this.x += this.vx; this.y += this.vy; this.draw(); }
}

class Enemy extends Entity {
    constructor(x, y) { super(x, y, 15, '#ef4444'); this.speed = 1; this.lastFire = 0; }
    update(lvl) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed; this.y += Math.sin(angle) * this.speed;
        if (Date.now() - this.lastFire > (lvl > 10 ? 1500 : 3000)) {
            enemyProjectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 4, Math.sin(angle) * 4));
            this.lastFire = Date.now();
        }
        this.draw();
    }
}

function animate() {
    if (!gameActive || isPaused) return;
    animationId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.update();

    projectiles = projectiles.filter(p => {
        p.update();
        return p.x > 0 && p.x < canvas.width && p.y > 0 && p.y < canvas.height;
    });

    enemies = enemies.filter(e => {
        e.update(1);
        const hit = projectiles.find(p => Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius);
        if (hit) projectiles = projectiles.filter(p => p !== hit);

        if (Math.hypot(player.x - e.x, player.y - e.y) < e.radius + player.radius) {
            if (!player.shieldActive) damagePlayer(10);
            return false;
        }
        return !hit;
    });

    enemyProjectiles = enemyProjectiles.filter(ep => {
        ep.update();
        if (Math.hypot(player.x - ep.x, player.y - ep.y) < ep.radius + player.radius) {
            if (!player.shieldActive) damagePlayer(5);
            return false;
        }
        return ep.x > 0 && ep.x < canvas.width && ep.y > 0 && ep.y < canvas.height;
    });

    if (enemiesSpawned >= currentMaxEnemies && enemies.length === 0) showGameModal('win-modal');
}

function damagePlayer(amt) {
    player.health -= amt;
    DOM.healthFill.style.width = `${Math.max(0, player.health)}%`;
    if (player.health <= 0) showGameModal('game-over-modal');
}

function initGame() {
    clearTerminal();
    const lvl = parseInt(DOM.lvlTitle.innerText.replace('Level ', '')) || 1;
    currentMaxEnemies = lvl * 5 + 5;
    player = new PlayerEntity(canvas.width / 2, canvas.height - 50);
    enemies = []; projectiles = []; enemyProjectiles = []; enemiesSpawned = 0;
    gameActive = true;
    if (spawnInterval) clearInterval(spawnInterval);
    spawnInterval = setInterval(() => {
        if (enemiesSpawned < currentMaxEnemies) {
            enemies.push(new Enemy(Math.random() * canvas.width, 0));
            enemiesSpawned++;
        }
    }, 2000);
    setTimeout(fetchNewPuzzle, 5000);
    animate();
}

// --- MODALS ---
function showGameModal(id) {
    gameActive = false;
    const m = document.getElementById(id);
    m.style.display = 'flex';
    requestAnimationFrame(() => m.classList.add('show'));
    if (timerId) clearInterval(timerId);
}

// --- INITIALIZATION ---
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
});

applyUnlockedLevelsUI();
lucide.createIcons();
applyUnlockedLevelsUI(); // Fix for potential icon replacement