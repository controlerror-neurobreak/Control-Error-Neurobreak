// --- API HELPER FUNCTION ---
const API_BASE =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://control-error-neurobreak.onrender.com";


async function apiCall(endpoint, method = 'GET', body = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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

        // Improve "Failed to fetch" message for clarity
        if (errorMsg.toLowerCase().includes('failed to fetch')) {
            errorMsg = "Connection Failed: Could not connect to the backend server. Please ensure the server is running ('npm start').";
        }

        console.error(`API Error (${endpoint}):`, errorMsg);
        return { data: null, error: { message: errorMsg } };
    }
}

// --- CUSTOM ALERT FUNCTION ---
function showCustomAlert(message, type = 'info', title = 'Notification') {
    const modal = document.getElementById('custom-alert-modal');
    const content = modal.querySelector('.custom-alert-content');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');

    content.classList.remove('error', 'success', 'warning');
    if (type === 'error') content.classList.add('error');
    if (type === 'success') content.classList.add('success');
    if (type === 'warning') content.classList.add('warning');

    msgEl.innerText = message;

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Custom alert close handlers
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-alert') || e.target.id === 'custom-alert-ok' || e.target.id === 'custom-alert-modal') {
        const modal = document.getElementById('custom-alert-modal');
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
});

// --- PASSWORD VISIBILITY TOGGLE ---
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-password');
    if (toggle) {
        const passwordContainer = toggle.closest('.password-container');
        const passwordInput = passwordContainer.querySelector('input');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggle.innerHTML = '<i data-lucide="eye-off" class="eye-icon"></i>';
        } else {
            passwordInput.type = 'password';
            toggle.innerHTML = '<i data-lucide="eye" class="eye-icon"></i>';
        }
        // Re-render the new icon
        lucide.createIcons();
    }
});

// --- ELEMENT SELECTORS ---
let bgGradient = document.querySelector(".bg-gradient");
let playLevelsCont = document.querySelector(".play-levels");
let playBtn = document.querySelector(".play-card");
let rulesBtn = document.querySelector(".rules-card");
let rulesPageCont = document.querySelector(".rules-page-cont");
let mainContainer = document.querySelector(".container");
let backToHomeFromRulesBtn = document.querySelector("#rules-to-home");
let backToLevelsFromRulesBtn = document.querySelector("#rules-to-levels");
let backToHomeFromPlayLevelsBtn = document.querySelector(".back-btn-play-levels");
let backToLevelsFromGame = document.querySelector("#game-to-levels");
let lvlNo = document.querySelector(".level-title");
let lvls = document.querySelectorAll(".lvls");
let settingsBtn = document.querySelector("#profile-settings-btn");
let settingsCont = document.querySelector(".settings");
let closeSettingsBtn = document.querySelector("#close-settings-icon");
let themeBtn = document.querySelector("#theme-btn");
let themeText = themeBtn?.querySelector(".theme-text");

const homeUIElements = [document.querySelector("#profile-toggle"), document.querySelector("#top-logout-btn")];

// --- AGE VERIFICATION ELEMENTS ---
const ageModal = document.getElementById('age-modal');
const ageGroupInit = document.getElementById('age-group-dropdown-init');
const saveAgeBtn = document.getElementById('save-age-btn');
const ageErrorMsg = document.getElementById('age-error-msg');
let userAge = null;

// --- LEVEL PERSISTENCE ---
function getUnlockedLevels() {
    const saved = localStorage.getItem('unlocked_levels');
    return saved ? JSON.parse(saved) : [1]; // Level 1 always unlocked
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
    lvls.forEach((lvlNode, index) => {
        const lvlNum = index + 1;
        if (unlocked.includes(lvlNum)) {
            const lock = lvlNode.querySelector('.lock-icon');
            if (lock) lock.remove();

            // Set text if empty
            if (lvlNode.innerText.trim() === "") {
                lvlNode.innerText = lvlNum;
            }
            lvlNode.classList.remove('locked');
        } else {
            lvlNode.classList.add('locked');
            // Ensure lock icon exists if not Level 1 and locked
            if (lvlNum > 1 && !lvlNode.querySelector('.lock-icon')) {
                lvlNode.innerHTML = '<i data-lucide="lock" class="lock-icon"></i>';
                lucide.createIcons();
            }
        }
    });
}

// Initialize on load
applyUnlockedLevelsUI();

// --- GAME STATE ELEMENTS ---
const pauseModal = document.getElementById('pause-modal');
const gameOverModal = document.getElementById('game-over-modal');
const winModal = document.getElementById('win-modal');
const pauseBtn = document.getElementById('pause-btn');

let isPaused = false;

function showGameModal(modalId) {
    console.log(`[DEBUG] showGameModal called for: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`[DEBUG] Modal with id ${modalId} not found!`);
        return;
    }
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    gameActive = false;

    // Stop the timer and puzzles when any game modal is shown
    if (timerId) {
        console.log(`[DEBUG] Clearing timerId: ${timerId}`);
        clearInterval(timerId);
        timerId = null;
    }
    if (puzzleInterval) {
        clearInterval(puzzleInterval);
        puzzleInterval = null;
    }
}

function hideGameModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

let animationId = null;
function animate() {
    if (!gameActive || isPaused) {
        animationId = null;
        return;
    }
    animationId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (player) player.update();

    // ... rest of the logic ...
}

function togglePause() {
    if (!gameActive && !isPaused) return;

    isPaused = !isPaused;
    if (isPaused) {
        showGameModal('pause-modal');
    } else {
        hideGameModal('pause-modal');
        gameActive = true;
        if (!animationId) animate(); // Only start if not already running
    }
}

pauseBtn.addEventListener('click', togglePause);

// Menu Actions
document.getElementById('pause-resume').addEventListener('click', togglePause);
document.getElementById('pause-restart').addEventListener('click', () => {
    hideGameModal('pause-modal');
    isPaused = false;
    restartGame();
});
document.getElementById('pause-home').addEventListener('click', () => {
    hideGameModal('pause-modal');
    isPaused = false;
    exitGameToLevels();
});

document.getElementById('death-restart').addEventListener('click', () => {
    hideGameModal('game-over-modal');
    restartGame();
});
document.getElementById('death-home').addEventListener('click', () => {
    hideGameModal('game-over-modal');
    exitGameToLevels();
});

document.getElementById('win-replay').addEventListener('click', () => {
    hideGameModal('win-modal');
    restartGame();
});
document.getElementById('win-home').addEventListener('click', () => {
    hideGameModal('win-modal');
    exitGameToLevels();
});
// Next level logic
document.getElementById('win-next').addEventListener('click', () => {
    hideGameModal('win-modal');
    const currentLvlNum = parseInt(lvlNo.innerText.replace('Level ', '')) || 1;
    const nextLvlNum = currentLvlNum + 1;

    unlockNextLevel(nextLvlNum);
    lvlNo.innerHTML = `Level ${nextLvlNum}`;
    restartGame();
});

function restartGame() {
    console.log("[DEBUG] restartGame called");
    if (timerId) clearInterval(timerId);
    time = 300;
    updateTimerDisplay();
    startTimer();
    initGame();
    if (!animationId) animate();
}

function startTimer() {
    timerId = setInterval(() => {
        if (isPaused) return;
        time--;
        updateTimerDisplay();
        if (time <= 0) {
            clearInterval(timerId);
            showGameModal('game-over-modal');
        }
    }, 1000);
}

function showHomeUI() {
    homeUIElements.forEach(el => { if (el) el.style.display = "block"; });
}

function hideHomeUI() {
    homeUIElements.forEach(el => { if (el) el.style.display = "none"; });
    settingsCont.classList.remove("active");
}

showHomeUI(); // Ensure visible by default

playBtn.addEventListener("click", () => {
    applyUnlockedLevelsUI();
    playLevelsCont.style.display = "block";
    bgGradient.style.display = "none";
    hideHomeUI();
});

rulesBtn.addEventListener("click", () => {
    mainContainer.style.display = "none";
    rulesPageCont.style.display = "block";
    hideHomeUI();
});

backToHomeFromRulesBtn.addEventListener("click", (e) => {
    e.preventDefault();
    mainContainer.style.display = "block";
    rulesPageCont.style.display = "none";
    showHomeUI();
});

backToLevelsFromRulesBtn.addEventListener("click", () => {
    rulesPageCont.style.display = "none";
    playLevelsCont.style.display = "block";
    bgGradient.style.display = "none";
    hideHomeUI();
});

backToHomeFromPlayLevelsBtn.addEventListener("click", () => {
    bgGradient.style.display = "flex";
    mainContainer.style.display = "block";
    playLevelsCont.style.display = "none";
    showHomeUI();
});

settingsBtn.addEventListener("click", () => {
    settingsCont.classList.toggle("active");
});

closeSettingsBtn.addEventListener("click", () => {
    settingsCont.classList.remove("active");
});

// --- GAMEPLAY & TIMER LOGIC ---

let time;
let timerId = null;

lvls.forEach((lvl) => {
    lvl.addEventListener("click", () => {
        const unlocked = getUnlockedLevels();
        const lvlNum = parseInt(lvl.innerText.trim());
        if (!unlocked.includes(lvlNum)) {
            return;
        }

        document.querySelector(".game-wrapper").style.display = "flex";
        playLevelsCont.style.display = "none";
        lvlNo.innerHTML = `Level ${lvl.innerText.trim()}`;
        if (settingsBtn) settingsBtn.style.display = "none";
        if (settingsCont) settingsCont.classList.remove("active");

        lucide.createIcons();

        if (timerId) clearInterval(timerId);
        time = 300;
        updateTimerDisplay();
        startTimer();

        initGame();
        if (!animationId) animate();
    });
});

function updateTimerDisplay() {
    let mins = Math.floor(time / 60);
    let secs = time % 60;
    document.getElementById('timer').textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function exitGameToLevels() {
    gameActive = false;
    isPaused = false;
    if (spawnInterval) clearInterval(spawnInterval);
    if (timerId) clearInterval(timerId);
    if (puzzleInterval) clearInterval(puzzleInterval);
    puzzleInterval = null;

    clearTerminal(); // Clear terminal when exiting level

    // Hide all game modals
    document.querySelectorAll('.game-modal-overlay').forEach(m => {
        m.classList.remove('show');
        m.style.display = 'none';
    });

    document.querySelector(".game-wrapper").style.display = "none";
    applyUnlockedLevelsUI();
    playLevelsCont.style.display = "block";
    settingsBtn.style.display = "block";
}

// Delegated listener for back button because lucide replaces the element
document.querySelector('.game-header').addEventListener("click", (e) => {
    if (e.target.id === 'game-to-levels' || e.target.closest('#game-to-levels')) {
        exitGameToLevels();
    }
});

// --- TERMINAL LOGIC ---

function addMyText(text, className = '') {
    const content = document.getElementById('terminal-content');
    if (!content) return;
    const newLine = document.createElement('div');
    newLine.className = `terminal-msg ${className}`;
    newLine.textContent = text;
    content.appendChild(newLine);
    content.scrollTop = content.scrollHeight;
}

function clearTerminal() {
    const content = document.getElementById('terminal-content');
    if (content) content.innerHTML = '';
}

const inputField = document.getElementById('term-input');
inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const userText = inputField.value.trim();
        if (userText !== "") {
            addMyText(`$ ${userText}`, 'terminal-user');
            inputField.value = "";
            inputField.blur(); // Remove focus after entering

            if (currentPuzzle) {
                const isCorrect = userText.toLowerCase() === currentPuzzle.answer.toLowerCase() ||
                    userText === (currentPuzzle.options.indexOf(currentPuzzle.answer) + 1).toString();

                if (isCorrect) {
                    addMyText("✔ CORRECT. SYSTEMS OPTIMIZED.", 'terminal-success');
                    addMyText("Waiting for next security layer (10s)...", 'terminal-msg');
                    resetControls();
                    setTimeout(() => fetchNewPuzzle(), 10000); // Fetch next only on success
                } else {
                    puzzleAttempts++;
                    // Trigger terminal shake
                    const termSection = document.querySelector('.terminal-section');
                    termSection.classList.remove('shake');
                    void termSection.offsetWidth; // Trigger reflow for animation restart
                    termSection.classList.add('shake');
                    setTimeout(() => termSection.classList.remove('shake'), 400);

                    if (puzzleAttempts >= 2) {
                        addMyText("❌ MAXIMUM ATTEMPTS EXCEEDED. SYSTEM CRITICAL.", 'terminal-error');
                        gameActive = false;
                        showGameModal('game-over-modal');
                    } else {
                        addMyText(`❌ INCORRECT. ${2 - puzzleAttempts} ATTEMPT REMAINING.`, 'terminal-warning');
                    }
                }
            }
        }
    }
});

addMyText("System Initialized. Awaiting input...");

// --- SETTINGS PERSISTENCE HELPER ---
async function updateGameSetting(settingKey, value) {
    if (!currentUser) {
        localStorage.setItem(settingKey, value);
        return;
    }

    // Save to server
    const metadata = { ...currentUser.user_metadata, [settingKey]: value };
    const { data, error } = await apiCall('/api/update-user', 'POST', {
        userId: currentUser.id,
        metadata: metadata
    });

    if (!error && data.user) {
        currentUser = data.user;
        const savedSession = localStorage.getItem('pilot_session');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            session.user = currentUser;
            localStorage.setItem('pilot_session', JSON.stringify(session));
        }
    }
}

// --- DRAGGABLE TERMINAL LOGIC ---
const terminalBox = document.querySelector('.terminal-section');
const terminalHeader = document.querySelector('.terminal-header');
const dragToggle = document.getElementById('dragSetting');
const soundToggle = document.getElementById('soundSetting');
let isLocked = true;

dragToggle.addEventListener('change', async (e) => {
    isLocked = !e.target.checked;
    if (isLocked) {
        terminalBox.classList.remove('drag-enabled');
        terminalBox.style.position = ''; terminalBox.style.left = ''; terminalBox.style.top = ''; terminalBox.style.zIndex = '';
    } else {
        terminalBox.classList.add('drag-enabled');
    }
    await updateGameSetting('allow_drag', e.target.checked);
});

soundToggle.addEventListener('change', async (e) => {
    await updateGameSetting('allow_sound', e.target.checked);
});

// Function to initialize settings from profile
function initSettings() {
    if (currentUser) {
        const d = currentUser.user_metadata.allow_drag ?? false;
        const s = currentUser.user_metadata.allow_sound ?? true;

        if (dragToggle) dragToggle.checked = d;
        isLocked = !d;
        if (!isLocked && terminalBox) terminalBox.classList.add('drag-enabled');

        if (soundToggle) soundToggle.checked = s;
    } else {
        if (dragToggle) dragToggle.checked = localStorage.getItem('allow_drag') === 'true';
        if (soundToggle) soundToggle.checked = localStorage.getItem('allow_sound') !== 'false'; // Default true
        if (dragToggle) isLocked = !dragToggle.checked;
    }
    initTheme();
}

function initTheme() {
    const savedTheme = localStorage.getItem('game_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
}

function updateThemeUI(theme) {
    if (themeText) {
        themeText.innerText = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('game_theme', newTheme);
    updateThemeUI(newTheme);
}

if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
}

terminalBox.addEventListener('mousedown', (e) => {
    if (isLocked) return;
    if (!e.target.closest('.terminal-header')) return;

    let offsetX = e.clientX - terminalBox.offsetLeft;
    let offsetY = e.clientY - terminalBox.offsetTop;

    function onMouseMove(e) {
        terminalBox.style.left = (e.clientX - offsetX) + 'px';
        terminalBox.style.top = (e.clientY - offsetY) + 'px';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', () => {
        document.removeEventListener('mousemove', onMouseMove);
    }, { once: true });
});

// --- AUTHENTICATION LOGIC (SECURE BACKEND VERSION) ---

const usernameOverlay = document.getElementById('username-overlay');
const usernameInput = document.getElementById('username-input');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const usernameSubmit = document.getElementById('username-submit');
const usernameError = document.getElementById('username-error');
const authTitle = document.getElementById('auth-title');
const authToggleLink = document.getElementById('auth-toggle-link');
const forgotPassLink = document.getElementById('forgot-pass-link');

let isLoginMode = false;
let currentUser = null;
let userSubjectPreferences = "";

const subjectPrefModal = document.getElementById('subject-preference-modal');
const subjectPrefForm = document.getElementById('subject-pref-form');
const openSubjectPrefBtn = document.getElementById('profile-subject-btn');
const subjectErrorMsg = document.getElementById('subject-error-msg');

// Persistent Session Check (Manual via localStorage + URL Hash handling)
async function checkSession() {
    // 1. Check for tokens in URL hash (from email redirects)
    const hash = window.location.hash.substring(1);
    if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const tokenType = params.get('type');

        if (accessToken) {
            console.log("Token detected in URL, processing session...");
            // Save minimal session
            localStorage.setItem('pilot_session', JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }));

            // Clear hash
            window.history.replaceState(null, null, window.location.pathname);

            // If it's a password recovery, show the reset modal
            if (tokenType === 'recovery') {
                const resetModal = document.getElementById('password-reset-modal');
                if (resetModal) {
                    resetModal.style.display = 'flex';
                    setTimeout(() => resetModal.classList.add('show'), 10);
                }
            }
        }
    }

    const savedSession = localStorage.getItem('pilot_session');
    if (savedSession) {
        try {
            let session = JSON.parse(savedSession);

            // If we have token but no user, fetch user details
            if (session.access_token && !session.user) {
                const { data, error } = await apiCall('/api/me', 'GET');
                if (!error && data.user) {
                    session.user = data.user;
                    localStorage.setItem('pilot_session', JSON.stringify(session));
                } else {
                    console.error("Failed to fetch user after token redirect", error);
                    return; // Don't proceed without user
                }
            }

            if (session.user) {
                currentUser = session.user;
                usernameOverlay.style.display = "none";
                document.getElementById('profile-username').innerText = currentUser.user_metadata.display_name || "Pilot";
                initSettings();
                checkAge(); // Check age before subjects
                // checkSubjectPreferences(); // Moved to be called after age check or if age exists
                showHomeUI();
            } else {
                showHomeUI(); // Still show buttons for guests
            }
        } catch (e) {
            console.error("Session parse error", e);
            showHomeUI();
        }
    } else {
        showHomeUI(); // No session, still show buttons
        // Proactive prompt: Show login modal on first visit if not logged in
        usernameOverlay.style.display = "flex";
        setTimeout(() => usernameOverlay.classList.add('show'), 10);
    }
}
checkSession();
initSettings();

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    usernameError.innerText = "";
    usernameError.style.color = "var(--accent-danger)";
    const confirmPassCont = document.getElementById('confirm-password-container');
    if (isLoginMode) {
        authTitle.innerText = "PILOT LOGIN";
        usernameInput.style.display = "none";
        confirmPassCont.style.display = "none";
        passwordInput.placeholder = "Enter your password...";
        usernameSubmit.innerText = "Login & Start";
        authToggleLink.innerText = "Register here";
        forgotPassLink.style.display = "block";
    } else {
        authTitle.innerText = "PILOT REGISTRATION";
        usernameInput.style.display = "block";
        confirmPassCont.style.display = "block";
        passwordInput.placeholder = "Create a password...";
        usernameSubmit.innerText = "Register & Start";
        authToggleLink.innerText = "Login here";
        forgotPassLink.style.display = "none";
    }
});

usernameSubmit.addEventListener('click', async () => {
    const userVal = usernameInput.value.trim();
    const emailVal = emailInput.value.trim();
    const passVal = passwordInput.value.trim();
    const confirmPassVal = document.getElementById('confirm-password-input').value.trim();

    if (!emailVal || passVal.length < 6) {
        usernameError.innerText = "Valid email & 6+ char password required.";
        return;
    }

    if (isLoginMode) {
        const { data, error } = await apiCall('/api/login', 'POST', { email: emailVal, password: passVal });
        if (error) {
            usernameError.innerText = "Login failed: " + error.message;
        } else {
            localStorage.setItem('pilot_session', JSON.stringify(data.session));
            location.reload();
        }
    } else {
        if (!userVal) { usernameError.innerText = "Callsign required!"; return; }
        if (passVal !== confirmPassVal) {
            usernameError.innerText = "Passwords do not match.";
            return;
        }

        // Check username uniqueness
        const { data: checkData, error: checkError } = await apiCall(`/api/check-username?username=${encodeURIComponent(userVal)}`, 'GET');
        if (checkData && checkData.exists) {
            usernameError.innerText = "This callsign is already claimed!";
            return;
        }

        const { data, error } = await apiCall('/api/register', 'POST', {
            email: emailVal,
            password: passVal,
            username: userVal
        });

        if (error) {
            usernameError.innerText = error.message;
        } else {
            usernameError.style.color = "#2ecc71";
            usernameError.innerText = data.message;
        }
    }
});

// --- PROFILE MANAGEMENT ---

const profileOverlay = document.getElementById('profile-modal');
const profileUsername = document.getElementById('profile-username');
const newPassInput = document.getElementById('new-pass');
const changePassBtn = document.getElementById('change-pass-btn');
const profileMsg = document.getElementById('profile-msg');

function toggleProfile(forceClose = false) {
    if (forceClose || profileOverlay.classList.contains('show')) {
        profileOverlay.classList.remove('show');
        setTimeout(() => { profileOverlay.style.display = 'none'; }, 400);
    } else {
        if (!currentUser) {
            // Guest click: bring up login modal again
            usernameOverlay.style.display = 'flex';
            setTimeout(() => usernameOverlay.classList.add('show'), 10);
            return;
        }

        // Populate fields
        document.getElementById('change-username-input').value = currentUser.user_metadata.display_name || "";
        document.getElementById('age-group-dropdown').value = currentUser.user_metadata.age_group || "";

        profileOverlay.style.display = 'flex';
        setTimeout(() => { profileOverlay.classList.add('show'); }, 10);
    }
}

document.addEventListener('click', (e) => {
    if (e.target.closest('#profile-toggle')) toggleProfile();
    if (e.target.classList.contains('close-profile') || e.target.id === 'profile-modal') toggleProfile(true);
    if (e.target.closest('#top-logout-btn')) {
        logoutModal.style.display = 'flex';
        setTimeout(() => logoutModal.classList.add('show'), 10);
    }
});

// Profile Modal Inner Actions
document.getElementById('update-username-btn').addEventListener('click', async () => {
    const newUsername = document.getElementById('change-username-input').value.trim();
    if (!newUsername || newUsername === currentUser.user_metadata.display_name) return;

    profileMsg.style.color = "var(--accent-indigo)";
    profileMsg.innerText = "Checking availability...";

    const { data: checkData } = await apiCall(`/api/check-username?username=${encodeURIComponent(newUsername)}`, 'GET');
    if (checkData && checkData.exists) {
        profileMsg.style.color = "var(--accent-danger)";
        profileMsg.innerText = "Username unavailable.";
        return;
    }

    const { data, error } = await apiCall('/api/update-user', 'POST', {
        userId: currentUser.id,
        metadata: { ...currentUser.user_metadata, display_name: newUsername }
    });

    if (!error) {
        currentUser = data.user;
        document.getElementById('profile-username').innerText = newUsername;
        profileMsg.style.color = "var(--accent-success)";
        profileMsg.innerText = "Username updated!";

        // Update session
        const session = JSON.parse(localStorage.getItem('pilot_session'));
        session.user = currentUser;
        localStorage.setItem('pilot_session', JSON.stringify(session));
    }
});

document.getElementById('age-group-dropdown').addEventListener('change', async (e) => {
    const ageGroup = e.target.value;
    if (!ageGroup) return;

    const { data, error } = await apiCall('/api/update-user', 'POST', {
        userId: currentUser.id,
        metadata: { ...currentUser.user_metadata, age_group: ageGroup, age: parseInt(ageGroup.split('-')[1]) || 20 }
    });

    if (!error) {
        currentUser = data.user;
        userAge = currentUser.user_metadata.age;
        profileMsg.style.color = "var(--accent-success)";
        profileMsg.innerText = "Age group updated!";

        const session = JSON.parse(localStorage.getItem('pilot_session'));
        session.user = currentUser;
        localStorage.setItem('pilot_session', JSON.stringify(session));
    }
});

// Preferences listeners moved to consolidated blocks below or handled via delegation


changePassBtn.addEventListener('click', async () => {
    const newP = newPassInput.value.trim();
    if (newP.length < 6) { profileMsg.innerText = "Password too short."; return; }

    profileMsg.style.color = "#3498db";
    profileMsg.innerText = "Updating...";

    const { error } = await apiCall('/api/update-user', 'POST', {
        userId: currentUser.id,
        password: newP
    });

    if (error) {
        profileMsg.style.color = "#e74c3c";
        profileMsg.innerText = error.message;
    } else {
        profileMsg.style.color = "#2ecc71";
        profileMsg.innerText = "Updated!";
    }
});

// --- LOGOUT & RECOVERY ---

// --- LOGOUT LOGIC (CUSTOM POP-UP) ---
const logoutModal = document.getElementById('logout-confirm-modal');

// Logout logic handled by delegated listener at line 763


document.getElementById('cancel-logout').addEventListener('click', () => {
    logoutModal.classList.remove('show');
    setTimeout(() => { logoutModal.style.display = 'none'; }, 300);
});

document.getElementById('real-confirm-logout').addEventListener('click', () => {
    localStorage.removeItem('pilot_session');
    location.reload();
});

// --- DELETE ACCOUNT LOGIC ---
const deleteModal = document.getElementById('delete-confirm-modal');
const purgeAcknowledge = document.getElementById('purge-acknowledge');
const finalDeleteBtn = document.getElementById('final-delete-btn');
const purgeProgressCont = document.getElementById('purge-progress-cont');
const purgeProgressFill = document.getElementById('purge-progress-fill');
const cancelDeleteBtn = document.getElementById('cancel-delete');

document.getElementById('delete-account-btn').addEventListener('click', () => {
    toggleProfile(true);
    // Reset modal state
    if (purgeAcknowledge) purgeAcknowledge.checked = false;
    finalDeleteBtn.disabled = true;
    finalDeleteBtn.classList.add('disabled');
    if (purgeProgressCont) purgeProgressCont.style.display = 'none';
    if (purgeProgressFill) purgeProgressFill.style.width = '0%';
    cancelDeleteBtn.style.display = 'block';
    document.getElementById('delete-password-input').value = '';
    document.getElementById('delete-error-msg').innerText = '';

    deleteModal.style.display = 'flex';
    setTimeout(() => deleteModal.classList.add('show'), 10);
});

if (purgeAcknowledge) {
    purgeAcknowledge.addEventListener('change', () => {
        finalDeleteBtn.disabled = !purgeAcknowledge.checked;
        if (purgeAcknowledge.checked) {
            finalDeleteBtn.classList.remove('disabled');
        } else {
            finalDeleteBtn.classList.add('disabled');
        }
    });
}

finalDeleteBtn.addEventListener('click', async () => {
    const password = document.getElementById('delete-password-input').value;
    const errorMsg = document.getElementById('delete-error-msg');
    const modalContent = deleteModal.querySelector('.profile-content');

    if (!password) {
        errorMsg.innerText = 'Authorization code required.';
        modalContent.classList.add('shake-animation');
        setTimeout(() => modalContent.classList.remove('shake-animation'), 400);
        return;
    }

    errorMsg.style.color = '#3498db';
    errorMsg.innerText = 'AUTHORIZING PURGE...';

    // Start Purge Sequence
    finalDeleteBtn.disabled = true;
    finalDeleteBtn.classList.add('disabled');
    if (purgeAcknowledge) purgeAcknowledge.disabled = true;
    cancelDeleteBtn.style.display = 'none'; // Lock them in
    if (purgeProgressCont) purgeProgressCont.style.display = 'block';

    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        if (purgeProgressFill) purgeProgressFill.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
            executeFinalPurge();
        }
    }, 75); // ~1.5 seconds total

    async function executeFinalPurge() {
        errorMsg.innerText = 'EXECUTING FINAL PURGE...';
        const { error } = await apiCall('/api/delete-account', 'POST', {
            userId: currentUser.id,
            password: password
        });

        if (error) {
            errorMsg.style.color = '#ff4d4d';
            errorMsg.innerText = 'DELETE FAILED: ' + (error.message || "Server error");
            modalContent.classList.add('shake-animation');
            setTimeout(() => modalContent.classList.remove('shake-animation'), 400);

            // Re-enable UI
            finalDeleteBtn.disabled = false;
            finalDeleteBtn.classList.remove('disabled');
            if (purgeAcknowledge) purgeAcknowledge.disabled = false;
            cancelDeleteBtn.style.display = 'block';
            if (purgeProgressCont) purgeProgressCont.style.display = 'none';
        } else {
            errorMsg.style.color = '#2ecc71';
            errorMsg.innerText = 'Account deleted successfully. Goodbye.';
            setTimeout(() => {
                localStorage.removeItem('pilot_session');
                location.reload();
            }, 2000);
        }
    }
});

document.getElementById('cancel-delete').addEventListener('click', () => {
    deleteModal.classList.remove('show');
    setTimeout(() => { deleteModal.style.display = 'none'; }, 300);
});

// --- RECOVERY LOGIC (FORGOT PASSWORD) ---
const recModal = document.getElementById('recovery-modal');
const recUsernameInput = document.getElementById('rec-username-input');
const recMsg = document.getElementById('rec-msg');

forgotPassLink.addEventListener('click', (e) => {
    e.preventDefault();
    usernameOverlay.style.display = "none";
    recModal.style.display = 'flex';
    setTimeout(() => recModal.classList.add('show'), 10);
});

// Profile modal forgot password link
document.getElementById('profile-forgot-pass').addEventListener('click', (e) => {
    e.preventDefault();
    toggleProfile(true);
    recModal.style.display = 'flex';
    setTimeout(() => recModal.classList.add('show'), 10);
});

document.querySelector('.close-recovery').addEventListener('click', () => {
    recModal.classList.remove('show');
    setTimeout(() => { recModal.style.display = 'none'; }, 300);
});

document.getElementById('rec-search-send-btn').addEventListener('click', async () => {
    const callsign = recUsernameInput.value.trim();
    if (!callsign) { recMsg.innerText = "Enter username."; return; }

    recMsg.style.color = "#3498db";
    recMsg.innerText = "Searching for account...";

    const { data, error } = await apiCall('/api/forgot-password', 'POST', { callsign });

    if (error) {
        recMsg.style.color = "#e74c3c";
        recMsg.innerText = error.message;
    } else {
        recMsg.style.color = "#2ecc71";
        recMsg.innerText = data.message;
    }
});

// --- SUBJECT PREFERENCES LOGIC ---

// Function to open modal
function showSubjectPrefModal() {
    // Pre-select existing preferences
    // Convert string to array for checking boxes, handling potential extra spaces
    const currentPrefs = userSubjectPreferences ? userSubjectPreferences.split(',').map(s => s.trim()) : [];

    const checkboxes = subjectPrefForm.querySelectorAll('input[name="subject"]');
    checkboxes.forEach(cb => {
        cb.checked = currentPrefs.includes(cb.value);
    });

    // Hide settings if open
    settingsCont.classList.remove("active");

    subjectPrefModal.style.display = 'flex';
    setTimeout(() => subjectPrefModal.classList.add('show'), 10);
}

// Check preferences on login
async function checkSubjectPreferences() {
    if (!currentUser) return;

    // Check if preferences exist in user metadata
    const prefs = currentUser.user_metadata.subject_preferences;

    if (prefs && typeof prefs === 'string' && prefs.length > 0) {
        userSubjectPreferences = prefs;
        console.log("Loaded subject preferences:", userSubjectPreferences);
    } else {
        // Handle legacy array format if exists
        if (Array.isArray(prefs) && prefs.length > 0) {
            userSubjectPreferences = prefs.join(', ');
            console.log("Loaded legacy array prefs via conversion:", userSubjectPreferences);
        } else {
            // "Ask once" logic: Check if we've already prompted in this browser session
            if (sessionStorage.getItem('subject_pref_prompted')) return;

            console.log("No subject preferences found, showing modal.");
            sessionStorage.setItem('subject_pref_prompted', 'true');
            showSubjectPrefModal();
        }
    }
}

// Settings button handler
if (openSubjectPrefBtn) {
    openSubjectPrefBtn.addEventListener('click', showSubjectPrefModal);
}

subjectPrefForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        subjectErrorMsg.innerText = "Please login to save preferences.";
        return;
    }

    // Get selected subjects
    const formData = new FormData(subjectPrefForm);
    const selectedSubjects = formData.getAll('subject');

    // Validation
    if (selectedSubjects.length === 0) {
        subjectErrorMsg.innerText = "Please select at least one subject.";
        return;
    }

    subjectErrorMsg.innerText = "";

    // Convert to string (User Request: "store them as strings")
    const preferencesString = selectedSubjects.join(', ');

    // Save to Supabase via Backend API
    const submitBtn = subjectPrefForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Saving...";
    submitBtn.disabled = true;

    const { data, error } = await apiCall('/api/update-user', 'POST', {
        userId: currentUser.id,
        metadata: { ...currentUser.user_metadata, subject_preferences: preferencesString }
    });

    if (error) {
        subjectErrorMsg.style.color = "#e74c3c";
        subjectErrorMsg.innerText = "Error saving: " + (error.message || "Server issue");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    } else {
        // Success
        if (data.user) currentUser = data.user;
        userSubjectPreferences = preferencesString;
        // Update the full session object
        const savedSession = localStorage.getItem('pilot_session');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            session.user = currentUser;
            localStorage.setItem('pilot_session', JSON.stringify(session));
        }

        submitBtn.innerText = "Saved!";
        setTimeout(() => {
            subjectPrefModal.classList.remove('show');
            setTimeout(() => {
                subjectPrefModal.style.display = 'none';
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }, 300);
        }, 800);
    }
});

// Update checkSession to call preference check
// (We append this to the existing checkSession logic or call it after)

// --- AGE VERIFICATION LOGIC ---
// (Variables moved to top of file to fix ReferenceError)

async function checkAge() {
    let ageFound = false;

    if (currentUser) {
        if (currentUser.user_metadata.age) {
            userAge = currentUser.user_metadata.age;
            ageFound = true;
        } else {
            // Check legacy local storage just in case
            const localAge = localStorage.getItem('pilot_age');
            if (localAge) {
                // Sync to account
                await updateGameSetting('age', localAge);
                userAge = localAge;
                ageFound = true;
            }
        }
    } else {
        const localAge = localStorage.getItem('pilot_age');
        if (localAge) {
            userAge = localAge;
            ageFound = true;
        }
    }

    if (ageFound) {
        checkSubjectPreferences();
    } else {
        showAgeModal();
    }
}

function showAgeModal() {
    // Hide others potentially
    usernameOverlay.style.display = 'none';
    ageModal.style.display = 'flex';
    setTimeout(() => ageModal.classList.add('show'), 10);
}

saveAgeBtn.addEventListener('click', async () => {
    const ageGroup = document.getElementById('age-group-dropdown-init').value;
    if (!ageGroup) {
        ageErrorMsg.innerText = "Please select an age group.";
        return;
    }

    ageErrorMsg.innerText = "";

    // Simulate Loading Sequence
    const originalText = saveAgeBtn.innerText;
    saveAgeBtn.disabled = true;
    saveAgeBtn.innerText = "Setting up...";

    await new Promise(r => setTimeout(r, 600));
    saveAgeBtn.innerText = "Calibrating...";
    await new Promise(r => setTimeout(r, 600));
    saveAgeBtn.innerText = "Finalizing...";
    await new Promise(r => setTimeout(r, 600));

    userAge = parseInt(ageGroup.split('-')[1]) || 20;
    localStorage.setItem('pilot_age_group', ageGroup);

    if (currentUser) {
        saveAgeBtn.innerText = "SYNCING PROFILE...";
        const { error } = await apiCall('/api/update-user', 'POST', {
            userId: currentUser.id,
            metadata: { ...currentUser.user_metadata, age_group: ageGroup, age: userAge }
        });

        if (error) {
            console.error("Age sync failed:", error);
        }
    }

    saveAgeBtn.innerText = "CALIBRATION COMPLETE";
    saveAgeBtn.style.background = "#2ecc71"; // Temporary Green

    setTimeout(() => {
        // Close modal
        ageModal.classList.remove('show');
        setTimeout(() => {
            ageModal.style.display = 'none';
            // Reset button for next time
            saveAgeBtn.innerText = originalText;
            saveAgeBtn.disabled = false;
            saveAgeBtn.style.background = "";
        }, 300);

        // Check subject prefs next if needed
        checkSubjectPreferences();
        showHomeUI();
    }, 800);
});


// --- SETTINGS OVERLAY LISTENER ---
window.addEventListener("click", (e) => {
    if (settingsCont.classList.contains("active") && !settingsCont.contains(e.target) && !settingsBtn.contains(e.target)) {
        settingsCont.classList.remove("active");
    }
});

console.log(userSubjectPreferences);

// --- CORE GAMEPLAY LOGIC ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player;
let projectiles = [];
let enemyProjectiles = []; // Enemy bullets
let enemies = [];
let keys = {};
let mousePos = { x: 0, y: 0 };
let lastFireTime = 0;
const FIRE_RATE = 250; // ms between shots
let gameActive = false;
let spawnInterval = null;

// --- CONTROL RANDOMIZATION LOGIC ---
let controlMapping = {
    'up': ['w', 'ArrowUp'],
    'down': ['s', 'ArrowDown'],
    'left': ['a', 'ArrowLeft'],
    'right': ['d', 'ArrowRight']
};
const defaultControls = JSON.parse(JSON.stringify(controlMapping));
let currentPuzzle = null;
let puzzleAttempts = 0;
let puzzleInterval = null;

function randomizeControls() {
    const directions = ['up', 'down', 'left', 'right'];
    const keysArr = [['w', 'ArrowUp'], ['s', 'ArrowDown'], ['a', 'ArrowLeft'], ['d', 'ArrowRight']];
    const shuffledKeys = [...keysArr].sort(() => Math.random() - 0.5);

    directions.forEach((dir, i) => {
        controlMapping[dir] = shuffledKeys[i];
    });
    addMyText("⚠️ GLITCH DETECTED: CONTROLS RANDOMIZED!", 'terminal-warning');
}

function resetControls() {
    controlMapping = JSON.parse(JSON.stringify(defaultControls));
    addMyText("✅ SYSTEMS RESTORED: CONTROLS NORMALIZED.", 'terminal-success');
    currentPuzzle = null;
}

async function fetchNewPuzzle() {
    if (!gameActive || isPaused) return;

    // First randomize controls
    randomizeControls();

    const currentLvl = parseInt(lvlNo.innerText.replace('Level ', '')) || 1;
    const subjectsString = currentUser?.user_metadata?.subject_preferences || "General Science";
    const ageToSend = userAge || 18; // Default to 18 if missing
    const { data, error } = await apiCall('/api/generate-puzzle', 'POST', { subjects: subjectsString, level: currentLvl, age: ageToSend });

    // Use fallback if API fails
    currentPuzzle = data || {
        question: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        answer: "4"
    };

    puzzleAttempts = 0;

    addMyText(`🧩 NEURAL PUZZLE DETECTED`, 'terminal-puzzle-header');
    addMyText(currentPuzzle.question, 'terminal-question');
    currentPuzzle.options.forEach((opt, i) => {
        addMyText(`${i + 1}. ${opt}`, 'terminal-option');
    });
    addMyText("Enter choice to restore systems.", 'terminal-msg');
}

// --- OPTIMIZED MOUSE HANDLING ---
let canvasRect = canvas.getBoundingClientRect();

function updateCanvasRect() {
    canvasRect = canvas.getBoundingClientRect();
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

window.addEventListener('resize', updateCanvasRect);
window.addEventListener('scroll', updateCanvasRect);

canvas.addEventListener('mousemove', (e) => {
    // Optimized: Uses cached rect to avoid reflows
    mousePos.x = e.clientX - canvasRect.left;
    mousePos.y = e.clientY - canvasRect.top;
});

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

class PlayerEntity extends Entity {
    constructor(x, y, radius, color) {
        super(x, y, radius, color);
        this.speed = 4;
        this.angle = 0;
        this.shieldActive = false;
        this.shieldCycleStart = Date.now();
    }

    drawCannon() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw the cannon barrel
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, -5, 30, 10);

        ctx.restore();
    }

    update() {
        if (controlMapping.up.some(k => keys[k])) this.y -= this.speed;
        if (controlMapping.down.some(k => keys[k])) this.y += this.speed;
        if (controlMapping.left.some(k => keys[k])) this.x -= this.speed;
        if (controlMapping.right.some(k => keys[k])) this.x += this.speed;

        // Boundaries
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Shield Logic (10s cycle: 5s ON, 5s OFF)
        const now = Date.now();
        const cycleTime = (now - this.shieldCycleStart) % 10000;
        this.shieldActive = (cycleTime < 5000);

        // Aiming
        this.angle = Math.atan2(mousePos.y - this.y, mousePos.x - this.x);

        this.drawCannon();

        // Visual Shield Effect
        if (this.shieldActive) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 12, 0, Math.PI * 2);
            // Pulsing color logic
            const pulse = (Math.sin(now / 150) + 1) / 2; // 0 to 1
            ctx.strokeStyle = `rgba(45, 212, 191, ${0.3 + pulse * 0.4})`;
            ctx.lineWidth = 4;
            ctx.stroke();

            // Outer Ring
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 15, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(45, 212, 191, ${pulse * 0.2})`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        this.draw();

        // Shooting
        if (keys[' ']) {
            const now = Date.now();
            if (now - lastFireTime > FIRE_RATE) {
                const velocity = {
                    x: Math.cos(this.angle) * 7,
                    y: Math.sin(this.angle) * 7
                };
                projectiles.push(new Projectile(this.x, this.y, 5, 'white', velocity));
                lastFireTime = now;
            }
        }
    }
}

class Projectile extends Entity {
    constructor(x, y, radius, color, velocity) {
        super(x, y, radius, color);
        this.velocity = velocity;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

// Enemy Projectile with homing behavior
class EnemyProjectile extends Entity {
    constructor(x, y, radius, color, targetX, targetY) {
        super(x, y, radius, color);
        this.speed = 3; // Slower than player bullets
        this.homingStrength = 0.05; // How much it adjusts toward player

        // Initial velocity toward target
        const angle = Math.atan2(targetY - y, targetX - x);
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    update() {
        // Homing behavior: adjust velocity toward player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > 0) {
            const distance = Math.sqrt(distanceSq); // Still need sqrt for normalization, but less frequent
            // Gradually adjust velocity toward player
            this.velocity.x += (dx / distance) * this.homingStrength;
            this.velocity.y += (dy / distance) * this.homingStrength;

            // Normalize to maintain speed
            const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            this.velocity.x = (this.velocity.x / currentSpeed) * this.speed;
            this.velocity.y = (this.velocity.y / currentSpeed) * this.speed;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

class Enemy extends Entity {
    constructor(x, y, radius, color) {
        super(x, y, radius, color);
        this.speed = Math.random() * 0.5 + 0.8; // Constant-ish speed
        this.lastFireTime = 0;
    }

    update(currentLevel) {
        // Homing logic: move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > 0) {
            const distance = Math.sqrt(distanceSq);
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }

        // Enemy firing logic with difficulty scaling
        const now = Date.now();
        let fireInterval;
        if (currentLevel <= 5) {
            fireInterval = 3000; // Fire every 3 seconds (easier)
        } else if (currentLevel <= 15) {
            fireInterval = 2000; // Fire every 2 seconds (medium)
        } else {
            fireInterval = 1500; // Fire every 1.5 seconds (harder)
        }

        if (now - this.lastFireTime > fireInterval) {
            // Fire at player's current position
            enemyProjectiles.push(new EnemyProjectile(
                this.x,
                this.y,
                5,
                '#f97316', // Orange color for enemy bullets
                player.x,
                player.y
            ));
            this.lastFireTime = now;
        }

        this.draw();
    }
}

let enemiesSpawned = 0;

// PLACE TO CHANGE ENEMY NUMBERS:
function getMaxEnemies(level) {
    if (level <= 5) return 10;
    if (level <= 15) return 20;
    return 25;
}

let currentMaxEnemies = 10;

function spawnEnemy() {
    if (isPaused) return;
    if (enemiesSpawned >= currentMaxEnemies) {
        if (spawnInterval) clearInterval(spawnInterval);
        return;
    }

    const radius = 15; // Constant size
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = 0; // Top of canvas
    enemies.push(new Enemy(x, y, radius, '#ef4444'));
    enemiesSpawned++;
}

function unlockNextLevel(nextLvlNum) {
    saveUnlockedLevel(nextLvlNum);
    applyUnlockedLevelsUI();
}

function initGame() {
    clearTerminal(); // Start with a fresh terminal
    const currentLvl = parseInt(lvlNo.innerText.replace('Level ', '')) || 1;
    currentMaxEnemies = getMaxEnemies(currentLvl);

    updateCanvasRect(); // Ensure size is correct on init
    player = new PlayerEntity(canvas.width / 2, canvas.height - 50, 15, 'cyan');
    player.health = 100; // Initialize health

    // Update Health UI
    const healthFill = document.getElementById('health-fill');
    const healthPercent = document.getElementById('health-percent');
    if (healthFill) healthFill.style.width = '100%';
    if (healthPercent) healthPercent.textContent = '100%';

    projectiles = [];
    enemyProjectiles = [];
    enemies = [];
    enemiesSpawned = 0;
    gameActive = true;

    if (spawnInterval) clearInterval(spawnInterval);
    // Spawning enemies: Change 1500 to spawn more/less frequently
    spawnInterval = setInterval(spawnEnemy, 1500);

    if (puzzleInterval) clearInterval(puzzleInterval);
    // puzzleInterval = setInterval(fetchNewPuzzle, 10000); // REPLACED: No auto-scramble
    // Fetch first puzzle
    addMyText("Neural Encryption initializing... (10s)", 'terminal-msg');
    setTimeout(fetchNewPuzzle, 10000); // Wait 10s before first question
    resetControls();
}

function animate() {
    if (!gameActive || isPaused) {
        animationId = null;
        return;
    }
    animationId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.update();

    // Use reverse loops for safe splicing
    for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex--) {
        const projectile = projectiles[pIndex];
        projectile.update();

        if (projectile.x + projectile.radius < 0 ||
            projectile.x - projectile.radius > canvas.width ||
            projectile.y + projectile.radius < 0 ||
            projectile.y - projectile.radius > canvas.height) {
            projectiles.splice(pIndex, 1);
        }
    }

    const currentLvl = parseInt(lvlNo.innerText.replace('Level ', '')) || 1;

    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
        const enemy = enemies[eIndex];
        enemy.update(currentLvl);

        // Collision with player: Optimized squared distance check
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distSq = dx * dx + dy * dy;
        const minDist = enemy.radius + player.radius;

        if (distSq < minDist * minDist) {
            if (!player.shieldActive) {
                player.health -= 10;

                // Update UI
                const healthFill = document.getElementById('health-fill');
                const healthPercent = document.getElementById('health-percent');
                if (healthFill) healthFill.style.width = `${Math.max(0, player.health)}%`;
                if (healthPercent) healthPercent.textContent = `${Math.max(0, player.health)}%`;

                if (player.health <= 0) {
                    console.log("[DEBUG] Game Over: Health reached 0 from enemy hit");
                    showGameModal('game-over-modal');
                    return; // Stop processing this frame
                }
            } else {
                console.log("[DEBUG] Shield blocked enemy collision");
            }
            enemies.splice(eIndex, 1);
            continue; // Enemy is gone, skip other checks for this enemy
        }

        // Projectile collision: Optimized squared distance check
        for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex--) {
            const projectile = projectiles[pIndex];
            const dx = projectile.x - enemy.x;
            const dy = projectile.y - enemy.y;
            const distSq = dx * dx + dy * dy;
            const minDist = enemy.radius + projectile.radius;

            if (distSq < minDist * minDist) {
                enemies.splice(eIndex, 1);
                projectiles.splice(pIndex, 1);
                break; // Enemy destroyed, move to next enemy
            }
        }

        // Cleanup out of bounds
        if (enemy.y > canvas.height + enemy.radius) {
            enemies.splice(eIndex, 1);
        }
    }

    for (let epIndex = enemyProjectiles.length - 1; epIndex >= 0; epIndex--) {
        const enemyProj = enemyProjectiles[epIndex];
        enemyProj.update();

        // Collision with player: Optimized squared distance check
        const dx = player.x - enemyProj.x;
        const dy = player.y - enemyProj.y;
        const distSq = dx * dx + dy * dy;
        const minDist = enemyProj.radius + player.radius;

        if (distSq < minDist * minDist) {
            if (!player.shieldActive) {
                player.health -= 10;

                const healthFill = document.getElementById('health-fill');
                const healthPercent = document.getElementById('health-percent');
                if (healthFill) healthFill.style.width = `${Math.max(0, player.health)}%`;
                if (healthPercent) healthPercent.textContent = `${Math.max(0, player.health)}%`;

                if (player.health <= 0) {
                    console.log("[DEBUG] Game Over: Health reached 0 from projectile hit");
                    showGameModal('game-over-modal');
                    return;
                }
            } else {
                console.log("[DEBUG] Shield blocked projectile hit");
            }
            enemyProjectiles.splice(epIndex, 1);
            continue;
        }

        // Collision with player bullets: Optimized squared distance check
        for (let ppIndex = projectiles.length - 1; ppIndex >= 0; ppIndex--) {
            const playerProj = projectiles[ppIndex];
            const dx = playerProj.x - enemyProj.x;
            const dy = playerProj.y - enemyProj.y;
            const distSq = dx * dx + dy * dy;
            const minDist = enemyProj.radius + playerProj.radius;

            if (distSq < minDist * minDist) {
                enemyProjectiles.splice(epIndex, 1);
                projectiles.splice(ppIndex, 1);
                break;
            }
        }

        // Cleanup
        if (enemyProj.x + enemyProj.radius < 0 ||
            enemyProj.x - enemyProj.radius > canvas.width ||
            enemyProj.y + enemyProj.radius < 0 ||
            enemyProj.y - enemyProj.radius > canvas.height) {
            enemyProjectiles.splice(epIndex, 1);
        }
    }

    // Victory Check
    if (gameActive && enemiesSpawned >= currentMaxEnemies && enemies.length === 0) {
        console.log("[DEBUG] Victory condition met");
        const currentLvl = parseInt(lvlNo.innerText.replace('Level ', '')) || 1;
        unlockNextLevel(currentLvl + 1);
        showGameModal('win-modal');
    }
}

window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);