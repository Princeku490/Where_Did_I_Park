/**
 * Where Did I Park — Multi-Page Application Script
 * ===================================================
 * Each HTML page has data-page="auth|map|pass|vehicles|history"
 * This script auto-detects the current page and runs ONLY
 * the logic needed for that page. No more cross-page DOM errors!
 *
 * Features:
 *  - 1.1: Animated Car Drive Simulation (map.html)
 *  - 1.3: Live EV Supercharger Panel (pass.html)
 *  - 2.2: Download / Print PDF Receipt (pass.html & history.html)
 *  - 2.3: Extend Parking Time (pass.html)
 *  - 2.4: Dummy UPI / Card Payment Gateway (map.html)
 *  - 3.1: Multiple Vehicle Support & Switcher (vehicles.html)
 *  - 4.1: Voice Assistant (all pages)
 *  - 4.2: 10-Minute Expiry Warning & Alert Chime (pass.html)
 */

// ==========================================================================
// 1. STORAGE KEYS & GLOBAL STATE
// ==========================================================================
const STORAGE_RIDERS       = 'where_did_i_park_riders_v3';
const STORAGE_CURRENT_USER = 'where_did_i_park_active_user_v3';
const STORAGE_THEME        = 'where_did_i_park_theme_v3';
const STORAGE_VOICE        = 'where_did_i_park_voice_pref_v3';
const HOURLY_RATE          = 20;  // ₹20 per hour
const EV_FLAT_FEE          = 30;  // ₹30 EV Supercharger fee

let currentUser        = null;
let isVoiceEnabled     = true;

// ==========================================================================
// 2. HELPERS — Storage, Formatting
// ==========================================================================
function getRiders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_RIDERS)) || []; } catch(e){ return []; }
}
function saveRiders(list) {
  localStorage.setItem(STORAGE_RIDERS, JSON.stringify(list));
}
function getActivePassKey() {
  return `where_did_i_park_active_pass_${currentUser ? currentUser.email : 'guest'}`;
}
function getHistoryKey() {
  return `where_did_i_park_history_list_${currentUser ? currentUser.email : 'guest'}`;
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
         ' — ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function formatTimeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} mins ago`;
  return `${Math.floor(sec / 3600)} hr ago`;
}
function el(id) { return document.getElementById(id); }

// ==========================================================================
// 3. AUDIO ENGINE — Beeps, Car Sound, Alert Chime
// ==========================================================================
function playBeep(freq = 520, dur = 0.08) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function playCarParkSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(), now = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.7);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.start(now); osc.stop(now + 0.7);
    setTimeout(() => { playBeep(980, 0.07); setTimeout(() => playBeep(1200, 0.08), 80); }, 750);
  } catch(e) {}
}
function playEmergencyAlertTone() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(), now = ctx.currentTime;
    [0, 0.15, 0.3].forEach(offset => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now + offset);
      osc.frequency.setValueAtTime(660, now + offset + 0.07);
      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.start(now + offset); osc.stop(now + offset + 0.12);
    });
  } catch(e) {}
}

// ==========================================================================
// 4. VOICE ASSISTANT (Feature 4.1)
// ==========================================================================
function speakVoice(text) {
  if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.05; u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  } catch(e) {}
}
function initVoice() {
  const saved = localStorage.getItem(STORAGE_VOICE);
  if (saved !== null) isVoiceEnabled = saved === 'true';
  updateVoiceBtn();
  const btn = el('voiceToggleBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    isVoiceEnabled = !isVoiceEnabled;
    localStorage.setItem(STORAGE_VOICE, isVoiceEnabled);
    updateVoiceBtn();
    playBeep(isVoiceEnabled ? 800 : 400, 0.08);
    showToast(`Voice Assistant ${isVoiceEnabled ? 'Enabled' : 'Muted'}`);
    if (isVoiceEnabled) speakVoice('Voice assistant activated.');
  });
}
function updateVoiceBtn() {
  const btn = el('voiceToggleBtn');
  const icon = el('voiceIcon');
  if (!btn || !icon) return;
  const sub = btn.querySelector('.btn-subtext');
  if (isVoiceEnabled) {
    btn.classList.add('active');
    icon.className = 'fa-solid fa-volume-high';
    if (sub) sub.textContent = 'Voice ON';
  } else {
    btn.classList.remove('active');
    icon.className = 'fa-solid fa-volume-xmark';
    if (sub) sub.textContent = 'Muted';
  }
}

// ==========================================================================
// 5. THEME TOGGLE (Light / Dark Mode)
// ==========================================================================
function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME) || 'dark';
  applyTheme(saved);
  const btn = el('themeToggleBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-mode');
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_THEME, next);
    playBeep(650, 0.06);
    showToast(`${next === 'dark' ? 'Dark' : 'Light'} Mode Activated`);
  });
}
function applyTheme(theme) {
  const icon = el('themeIcon'), text = el('themeText');
  if (theme === 'light') {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    if (icon) icon.className = 'fa-solid fa-moon';
    if (text) text.textContent = 'Dark Mode';
  } else {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    if (icon) icon.className = 'fa-solid fa-sun';
    if (text) text.textContent = 'Light Mode';
  }
}

// ==========================================================================
// 6. TOAST NOTIFICATION
// ==========================================================================
let _toastTimer = null;
function showToast(msg) {
  const wrap = el('toastNotification'), msgEl = el('toastMessage');
  if (!wrap || !msgEl) return;
  if (_toastTimer) clearTimeout(_toastTimer);
  msgEl.textContent = msg;
  wrap.classList.remove('hidden');
  _toastTimer = setTimeout(() => wrap.classList.add('hidden'), 3500);
}

// ==========================================================================
// 7. UNIVERSAL HEADER — User capsule, logout, live pass dot
// ==========================================================================
function initHeader() {
  if (!currentUser) return;

  const nameEl   = el('navUserName');
  const plateEl  = el('navUserPlate');
  const avatarEl = el('userAvatarLetter');
  const capsule  = el('userProfileCapsule');
  const logoutBtn= el('logoutBtn');

  if (nameEl)   nameEl.textContent   = currentUser.fullName;
  if (plateEl)  plateEl.textContent  = currentUser.plateNumber;
  if (avatarEl) avatarEl.textContent = currentUser.fullName.charAt(0).toUpperCase();
  if (capsule)  capsule.classList.remove('hidden');

  // Live pass dot — glow green if active pass exists
  const dot = el('navPassDot');
  if (dot) {
    const hasPass = !!localStorage.getItem(getActivePassKey());
    if (hasPass) dot.classList.remove('hidden');
    else         dot.classList.add('hidden');
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_CURRENT_USER);
      window.location.href = 'index.html';
    });
  }
}

// ==========================================================================
// 8. SESSION CHECK — Auth guard for protected pages
// ==========================================================================
function loadCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER);
    if (raw) { currentUser = JSON.parse(raw); return true; }
  } catch(e) {}
  return false;
}

function requireAuth(redirectIfLogged) {
  const loggedIn = loadCurrentUser();
  const page = document.body.dataset.page;

  if (page === 'auth') {
    // On login page — let auth page render guidelines or login form
    return false; // don't run protected-page logic
  }

  // Protected pages
  if (!loggedIn) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ==========================================================================
// 8.5 DEFAULT DEMO RIDER SEED
// ==========================================================================
const DEFAULT_DEMO_RIDER = {
  id: 'demo_rider_01',
  fullName: 'Alex Rider',
  email: 'alex@rider.com',
  phone: '9876543210',
  vehicleType: 'EV',
  plateNumber: 'Tata Nexon EV - DL 01 AB 7788',
  password: 'demo123',
  vehicles: [
    { type: 'EV',         plate: 'Tata Nexon EV - DL 01 AB 7788' },
    { type: 'Motorcycle', plate: 'Royal Enfield - DL 04 XY 9900' }
  ]
};

function ensureDefaultRiderSeeded() {
  const riders = getRiders();
  if (!riders.some(r => r.email === DEFAULT_DEMO_RIDER.email || r.phone === DEFAULT_DEMO_RIDER.phone)) {
    riders.push(DEFAULT_DEMO_RIDER);
    saveRiders(riders);
  }
}

// ==========================================================================
// 9. PAGE: WELCOME & AUTH (index.html)
// ==========================================================================
function initAuthPage() {
  initTheme();
  initVoice();
  ensureDefaultRiderSeeded();

  // Helper to display Welcome User & Parking Guidelines screen
  const showGuidelinesScreen = (user) => {
    const authCard = el('authCard');
    const guidelinesCard = el('guidelinesCard');
    const nameEl = el('welcomeUserName');
    const plateEl = el('welcomeUserPlate');
    const emailEl = el('welcomeUserEmail');
    const vehicleEl = el('welcomeUserVehicle');

    if (nameEl) nameEl.textContent = user.fullName || 'Rider';
    if (plateEl) plateEl.textContent = user.plateNumber || 'DL 01 AB 7788';
    if (emailEl) emailEl.textContent = user.email || '';
    if (vehicleEl) vehicleEl.textContent = `${user.vehicleType || 'Vehicle'} • Verified`;

    if (authCard) authCard.classList.add('hidden');
    if (guidelinesCard) guidelinesCard.classList.remove('hidden');

    playBeep(750, 0.12);
  };

  // Setup Proceed to Map button
  const proceedBtn = el('proceedToMapBtn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      playBeep(880, 0.15);
      showToast('Proceeding to Interactive Parking Map...');
      speakVoice('Entering parking map. Please choose your slot.');
      setTimeout(() => {
        window.location.href = 'map.html';
      }, 350);
    });
  }

  // Setup Switch Account / Sign Out button
  const switchBtn = el('guidelinesSwitchUserBtn');
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_CURRENT_USER);
      currentUser = null;
      if (el('guidelinesCard')) el('guidelinesCard').classList.add('hidden');
      if (el('authCard')) el('authCard').classList.remove('hidden');
      showToast('Signed out. You can now sign in with another account.');
      playBeep(450, 0.08);
    });
  }

  // Check if redirected from a protected page
  const redirectMsg = sessionStorage.getItem('auth_redirect_msg');
  if (redirectMsg) {
    showToast(redirectMsg);
    sessionStorage.removeItem('auth_redirect_msg');
  }

  // If already logged in, show Welcome User & Parking Guidelines
  if (loadCurrentUser()) {
    showGuidelinesScreen(currentUser);
    return;
  }

  // Auto-fill Demo Credentials Button
  const autoFillBtn = el('autoFillDemoBtn');
  if (autoFillBtn) {
    autoFillBtn.addEventListener('click', () => {
      const idInput  = el('loginIdentifier');
      const pwdInput = el('loginPassword');
      if (idInput && pwdInput) {
        idInput.value = 'alex@rider.com';
        pwdInput.value = 'demo123';
        playBeep(700, 0.06);
        showToast('Demo credentials auto-filled! Click "Sign In" to continue.');
        const submitBtn = el('loginSubmitBtn');
        if (submitBtn) submitBtn.focus();
      }
    });
  }

  // Tab switching: Sign In / Register
  const tabLogin    = el('tabLoginBtn');
  const tabRegister = el('tabRegisterBtn');
  const loginForm   = el('loginForm');
  const registerForm= el('registerForm');

  if (tabLogin) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      if (loginForm)    loginForm.classList.remove('hidden');
      if (registerForm) registerForm.classList.add('hidden');
      playBeep(500, 0.05);
    });
  }
  if (tabRegister) {
    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      if (registerForm) registerForm.classList.remove('hidden');
      if (loginForm)    loginForm.classList.add('hidden');
      playBeep(500, 0.05);
    });
  }

  // Password toggle — Login
  const toggleLoginPwd = el('toggleLoginPwd');
  const loginPassword  = el('loginPassword');
  if (toggleLoginPwd && loginPassword) {
    toggleLoginPwd.addEventListener('click', () => {
      const isPwd = loginPassword.type === 'password';
      loginPassword.type = isPwd ? 'text' : 'password';
      toggleLoginPwd.innerHTML = isPwd
        ? '<i class="fa-regular fa-eye-slash"></i>'
        : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // Password toggle — Register
  const toggleRegPwd = el('toggleRegPwd');
  const regPassword  = el('regPassword');
  if (toggleRegPwd && regPassword) {
    toggleRegPwd.addEventListener('click', () => {
      const isPwd = regPassword.type === 'password';
      regPassword.type = isPwd ? 'text' : 'password';
      toggleRegPwd.innerHTML = isPwd
        ? '<i class="fa-regular fa-eye-slash"></i>'
        : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // Register form submit
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fullName    = el('regFullName').value.trim();
      const email       = el('regEmail').value.trim().toLowerCase();
      const phone       = el('regPhone').value.trim();
      const vehicleType = el('regVehicleType').value;
      const plateNumber = el('regPlateNumber').value.trim();
      const password    = el('regPassword').value;

      if (!fullName || !email || !phone || !plateNumber || !password) {
        showToast('Please fill in all required fields.');
        return;
      }

      const riders = getRiders();
      if (riders.some(r => r.email === email || r.phone === phone)) {
        showToast('A rider with this email or phone is already registered. Please sign in.');
        return;
      }

      const newRider = {
        id: 'r_' + Date.now(),
        fullName, email, phone, vehicleType, plateNumber, password,
        vehicles: [{ type: vehicleType, plate: plateNumber }]
      };

      riders.push(newRider);
      saveRiders(riders);
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(newRider));
      currentUser = newRider;
      showToast(`Welcome ${fullName}! Registration complete. Please review parking guidelines.`);
      speakVoice(`Welcome ${fullName}. Please review parking guidelines before proceeding.`);
      showGuidelinesScreen(newRider);
    });
  }

  // Login form submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const identifier = el('loginIdentifier').value.trim().toLowerCase();
      const password   = el('loginPassword').value.trim();

      const riders = getRiders();
      let user = riders.find(r =>
        (r.email.toLowerCase() === identifier || r.phone === identifier)
        && r.password === password
      );

      // Fallback check against default demo rider
      if (!user && (identifier === DEFAULT_DEMO_RIDER.email || identifier === DEFAULT_DEMO_RIDER.phone) && password === DEFAULT_DEMO_RIDER.password) {
        user = DEFAULT_DEMO_RIDER;
      }

      if (!user) {
        showToast('Invalid credentials! Tip: Use alex@rider.com / demo123 or 1-Click Demo Login.');
        playBeep(300, 0.12);
        return;
      }

      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
      currentUser = user;
      showToast(`Welcome back, ${user.fullName}! Please review the parking guidelines.`);
      speakVoice(`Welcome back, ${user.fullName}. Please review the parking guidelines.`);
      showGuidelinesScreen(user);
    });
  }

  // 1-Click Demo Login (both buttons)
  const executeDemoLogin = () => {
    ensureDefaultRiderSeeded();
    localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(DEFAULT_DEMO_RIDER));
    currentUser = DEFAULT_DEMO_RIDER;
    showToast('Logged in as Demo Rider Alex! Review parking guidelines below.');
    speakVoice('Welcome Alex. You are now logged in. Please review the parking guidelines.');
    showGuidelinesScreen(DEFAULT_DEMO_RIDER);
  };

  const demoBtn = el('quickDemoLoginBtn');
  if (demoBtn) demoBtn.addEventListener('click', executeDemoLogin);

  const heroDemoBtn = el('heroDemoBtn');
  if (heroDemoBtn) heroDemoBtn.addEventListener('click', executeDemoLogin);
}

// ==========================================================================
// 10. PAGE: MAP & BOOKING (map.html)
// ==========================================================================

// --- Floor Slot Data ---
const floorLotsData = {
  'Ground Floor': {
    rowA: [
      { id: 'A-01', type: 'Car', status: 'available' },
      { id: 'A-02', type: 'Car', status: 'occupied'  },
      { id: 'A-03', type: 'Car', status: 'available' },
      { id: 'A-04', type: 'Car', status: 'occupied'  },
      { id: 'A-05', type: 'Car', status: 'available' },
      { id: 'A-06', type: 'Car', status: 'available' }
    ],
    rowB: [
      { id: 'B-01', type: 'SUV', status: 'available' },
      { id: 'B-02', type: 'SUV', status: 'available' },
      { id: 'B-03', type: 'SUV', status: 'occupied'  },
      { id: 'B-04', type: 'SUV', status: 'available' },
      { id: 'B-05', type: 'SUV', status: 'occupied'  },
      { id: 'B-06', type: 'SUV', status: 'available' }
    ],
    rowC: [
      { id: 'EV-01',  type: 'EV',   status: 'available' },
      { id: 'EV-02',  type: 'EV',   status: 'occupied'  },
      { id: 'BK-01',  type: 'Bike', status: 'available' },
      { id: 'BK-02',  type: 'Bike', status: 'available' },
      { id: 'BK-03',  type: 'Bike', status: 'occupied'  },
      { id: 'BK-04',  type: 'Bike', status: 'available' }
    ]
  },
  'Basement 1': {
    rowA: [
      { id: 'B1-A1', type: 'Car', status: 'occupied'  },
      { id: 'B1-A2', type: 'Car', status: 'available' },
      { id: 'B1-A3', type: 'Car', status: 'available' },
      { id: 'B1-A4', type: 'Car', status: 'occupied'  },
      { id: 'B1-A5', type: 'Car', status: 'available' },
      { id: 'B1-A6', type: 'Car', status: 'available' }
    ],
    rowB: [
      { id: 'B1-B1', type: 'SUV', status: 'available' },
      { id: 'B1-B2', type: 'SUV', status: 'available' },
      { id: 'B1-B3', type: 'SUV', status: 'occupied'  },
      { id: 'B1-B4', type: 'SUV', status: 'available' },
      { id: 'B1-B5', type: 'SUV', status: 'available' },
      { id: 'B1-B6', type: 'SUV', status: 'occupied'  }
    ],
    rowC: [
      { id: 'B1-EV1', type: 'EV',   status: 'available' },
      { id: 'B1-EV2', type: 'EV',   status: 'available' },
      { id: 'B1-BK1', type: 'Bike', status: 'available' },
      { id: 'B1-BK2', type: 'Bike', status: 'occupied'  },
      { id: 'B1-BK3', type: 'Bike', status: 'available' },
      { id: 'B1-BK4', type: 'Bike', status: 'available' }
    ]
  },
  'Basement 2': {
    rowA: [
      { id: 'B2-A1', type: 'Car', status: 'available' },
      { id: 'B2-A2', type: 'Car', status: 'available' },
      { id: 'B2-A3', type: 'Car', status: 'occupied'  },
      { id: 'B2-A4', type: 'Car', status: 'available' },
      { id: 'B2-A5', type: 'Car', status: 'available' },
      { id: 'B2-A6', type: 'Car', status: 'occupied'  }
    ],
    rowB: [
      { id: 'B2-B1', type: 'SUV', status: 'occupied'  },
      { id: 'B2-B2', type: 'SUV', status: 'available' },
      { id: 'B2-B3', type: 'SUV', status: 'available' },
      { id: 'B2-B4', type: 'SUV', status: 'available' },
      { id: 'B2-B5', type: 'SUV', status: 'available' },
      { id: 'B2-B6', type: 'SUV', status: 'available' }
    ],
    rowC: [
      { id: 'B2-EV1', type: 'EV',   status: 'available' },
      { id: 'B2-EV2', type: 'EV',   status: 'available' },
      { id: 'B2-BK1', type: 'Bike', status: 'available' },
      { id: 'B2-BK2', type: 'Bike', status: 'available' },
      { id: 'B2-BK3', type: 'Bike', status: 'occupied'  },
      { id: 'B2-BK4', type: 'Bike', status: 'available' }
    ]
  }
};

let currentSelectedFloor  = 'Ground Floor';
let selectedSlotId        = null;
let pendingBookingData    = null;
let currentBookedPass     = null;
let isAnimatingDrive      = false;

function initMapPage() {
  // Load active pass (to show "your spot" on map)
  try {
    const raw = localStorage.getItem(getActivePassKey());
    if (raw) currentBookedPass = JSON.parse(raw);
  } catch(e) {}

  // Populate vehicle dropdown in booking form
  const bookingPlateSelect = el('bookingPlateSelect');
  if (bookingPlateSelect && currentUser.vehicles) {
    bookingPlateSelect.innerHTML = '';
    currentUser.vehicles.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.plate;
      opt.textContent = `${v.type === 'EV' ? '⚡' : '🚗'} ${v.plate}`;
      if (v.plate === currentUser.plateNumber) opt.selected = true;
      bookingPlateSelect.appendChild(opt);
    });
  }

  // Floor tabs
  const levelTabBtns = document.querySelectorAll('.level-tab-btn');
  levelTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      levelTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSelectedFloor = btn.getAttribute('data-floor');
      const fi = el('chosenFloorInput');
      if (fi) fi.value = currentSelectedFloor;
      playBeep(480, 0.05);
      renderParkingLotMap();
    });
  });

  updateFareEstimate();
  renderParkingLotMap();

  // Fare estimate live update
  const durSel = el('parkingDurationSelect');
  const evCb   = el('enableEvChargingCheckbox');
  if (durSel) durSel.addEventListener('change', updateFareEstimate);
  if (evCb)   evCb.addEventListener('change',   updateFareEstimate);

  // Booking form submit → open payment modal
  const bookingForm = el('slotBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedSlotId) {
        showToast('Please click and select an available green bay from the map above!');
        document.querySelector('.parking-map-card') &&
          document.querySelector('.parking-map-card').scrollIntoView({ behavior: 'smooth' });
        speakVoice('Please pick a parking slot first.');
        return;
      }

      const hours       = parseInt(durSel ? durSel.value : '1', 10) || 1;
      const vehiclePlate= bookingPlateSelect ? bookingPlateSelect.value : currentUser.plateNumber;
      const isEvCharging= evCb ? evCb.checked : false;
      const notes       = el('bookingNotesInput') ? el('bookingNotesInput').value.trim() : '';
      const totalFee    = updateFareEstimate();

      pendingBookingData = { slotId: selectedSlotId, floor: currentSelectedFloor, vehiclePlate, notes, durationHours: hours, isEvCharging, fee: totalFee };
      localStorage.setItem('where_did_i_park_pending_booking', JSON.stringify(pendingBookingData));

      // Open payment page in a new tab
      try {
        window.open('payment.html', '_blank');
        showToast('Opening Payment Gateway in new tab...');
        speakVoice('Opening payment gateway in a new tab.');
      } catch(err) {}

      const mss = el('modalSummarySlot');
      const msv = el('modalSummaryVehicle');
      const msa = el('modalSummaryAmount');
      const pbl = el('payBtnLabel');
      if (mss) mss.textContent = `Slot ${selectedSlotId} (${currentSelectedFloor})`;
      if (msv) msv.textContent = `${hours} Hour${hours > 1 ? 's' : ''} • ${vehiclePlate}`;
      if (msa) msa.textContent = `₹${totalFee}`;
      if (pbl) pbl.textContent = `Pay ₹${totalFee} & Lock Spot`;

      const pps = el('paymentProcessingState');
      const pbr = el('paymentBtnRow');
      const pm  = el('paymentModal');
      if (pps) pps.classList.add('hidden');
      if (pbr) pbr.classList.remove('hidden');
      if (pm)  pm.classList.remove('hidden');
      playBeep(650, 0.08);
    });
  }

  // Open full payment in new tab button
  const openPaymentTabBtn = el('openPaymentTabBtn');
  if (openPaymentTabBtn) {
    openPaymentTabBtn.addEventListener('click', () => {
      if (pendingBookingData) {
        localStorage.setItem('where_did_i_park_pending_booking', JSON.stringify(pendingBookingData));
      }
      window.open('payment.html', '_blank');
    });
  }

  // Close payment modal
  const closePM = el('closePaymentModalBtn');
  if (closePM) closePM.addEventListener('click', () => el('paymentModal') && el('paymentModal').classList.add('hidden'));

  // Pay & Confirm
  const payBtn = el('payAndConfirmBtn');
  if (payBtn) {
    payBtn.addEventListener('click', () => {
      if (!pendingBookingData) return;
      const methodEl = document.querySelector('input[name="payMethod"]:checked');
      const selectedMethod = methodEl ? methodEl.value : 'UPI';

      const pbr = el('paymentBtnRow');
      const pps = el('paymentProcessingState');
      if (pbr) pbr.classList.add('hidden');
      if (pps) pps.classList.remove('hidden');
      playBeep(700, 0.1);

      setTimeout(() => {
        const pm = el('paymentModal');
        if (pm) pm.classList.add('hidden');
        playBeep(880, 0.2);

        const startTime = Date.now();
        const endTime   = startTime + pendingBookingData.durationHours * 3600000;
        const passId    = 'PK-' + Math.floor(1000 + Math.random() * 9000);

        showToast(`✅ Payment of ₹${pendingBookingData.fee} via ${selectedMethod} Successful!`);
        speakVoice(`Payment approved. Driving to Slot ${pendingBookingData.slotId}.`);

        const mapCard = document.querySelector('.parking-map-card');
        if (mapCard) mapCard.scrollIntoView({ behavior: 'smooth' });

        animateCarDrive(pendingBookingData.slotId, () => {
          const newPass = {
            passId,
            slotId:         pendingBookingData.slotId,
            floor:          pendingBookingData.floor,
            vehiclePlate:   pendingBookingData.vehiclePlate,
            notes:          pendingBookingData.notes,
            durationHours:  pendingBookingData.durationHours,
            startTime, endTime,
            fee:            pendingBookingData.fee,
            isEvCharging:   pendingBookingData.isEvCharging,
            batteryPct:     pendingBookingData.isEvCharging ? 42 : null,
            energyDelivered:pendingBookingData.isEvCharging ? 8.2 : null,
            paymentMethod:  selectedMethod
          };

          currentBookedPass = newPass;
          localStorage.setItem(getActivePassKey(), JSON.stringify(newPass));

          selectedSlotId = null;
          pendingBookingData = null;
          const csi = el('chosenSlotInput');
          const csb = el('chosenSlotBadge');
          const bni = el('bookingNotesInput');
          if (csi) csi.value = '';
          if (csb) csb.textContent = 'None';
          if (bni) bni.value = '';

          showToast(`🎉 Slot ${newPass.slotId} confirmed! Your digital pass is ready.`);
          speakVoice(`Parking at slot ${newPass.slotId} is confirmed. Redirecting to your pass.`);

          // Update live dot & redirect to pass page
          setTimeout(() => window.location.href = 'pass.html', 1000);
        });
      }, 1200);
    });
  }

  // -----------------------------------------------------------------------
  // PRIMARY VIEW TABS (Tab 1: Map, Tab 2: Directory, Tab 3: Calc, Tab 4: Rules)
  // -----------------------------------------------------------------------
  const viewTabBtns = document.querySelectorAll('.view-tab-btn');
  const viewTabPanes = document.querySelectorAll('.view-tab-pane');
  viewTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      viewTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewTabPanes.forEach(p => p.classList.add('hidden'));
      const target = document.getElementById(targetId);
      if (target) target.classList.remove('hidden');
      playBeep(580, 0.05);
      // Render slot directory when switching to that tab
      if (targetId === 'paneDirView') renderSlotDirectory();
    });
  });

  // -----------------------------------------------------------------------
  // CATEGORY FILTER PILLS (Filter: All, EV, Car, Bike)
  // -----------------------------------------------------------------------
  const catFilterBtns = document.querySelectorAll('.cat-filter-btn');
  catFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      playBeep(560, 0.05);
      // Visual filtering would happen here
      showToast(`Showing: ${btn.querySelector('span').textContent.trim()} slots`);
    });
  });

  // -----------------------------------------------------------------------
  // PAYMENT CATEGORY TABS (UPI, Card, Net Banking, FASTag, Exit Cash)
  // -----------------------------------------------------------------------
  const payCatTabBtns = document.querySelectorAll('.pay-cat-tab-btn');
  payCatTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      payCatTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const allPanes = document.querySelectorAll('.pay-cat-pane');
      allPanes.forEach(p => p.classList.add('hidden'));
      const targetPane = document.getElementById('payPane' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
      if (targetPane) targetPane.classList.remove('hidden');
      playBeep(620, 0.05);

      // Auto-set the payment method for non-UPI tabs
      if (tabId === 'fastag') {
        const mEl = document.querySelector('input[name="payMethod"][value="FASTag"]');
        if (!mEl) {
          // Set a custom value on a hidden input to track FASTag selection
          const hidEl = document.getElementById('selectedNetBankName');
          // We'll handle this on pay confirm
        }
      }
      if (tabId === 'cash') {
        const activeExit = document.querySelector('.exit-opt-card.active');
        // handled via exit opt cards
      }
    });
  });

  // -----------------------------------------------------------------------
  // NET BANKING — bank item cards
  // -----------------------------------------------------------------------
  const bankItemCards = document.querySelectorAll('.bank-item-card');
  bankItemCards.forEach(card => {
    card.addEventListener('click', () => {
      bankItemCards.forEach(b => b.classList.remove('active'));
      card.classList.add('active');
      const bankNameEl = document.getElementById('selectedNetBankName');
      if (bankNameEl) bankNameEl.value = card.dataset.bank || card.querySelector('span').textContent;
      playBeep(550, 0.05);
    });
  });

  const otherBanksSel = document.getElementById('otherBanksSelect');
  if (otherBanksSel) {
    otherBanksSel.addEventListener('change', () => {
      if (otherBanksSel.value) {
        bankItemCards.forEach(b => b.classList.remove('active'));
        const bankNameEl = document.getElementById('selectedNetBankName');
        if (bankNameEl) bankNameEl.value = otherBanksSel.value;
      }
    });
  }

  // -----------------------------------------------------------------------
  // EXIT OPT CARDS — click to select
  // -----------------------------------------------------------------------
  const exitOptCards = document.querySelectorAll('.exit-opt-card');
  exitOptCards.forEach(card => {
    card.addEventListener('click', () => {
      exitOptCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      playBeep(520, 0.05);
    });
  });

  // -----------------------------------------------------------------------
  // CARD INPUT — live preview on virtual card
  // -----------------------------------------------------------------------
  const cardInputNumber = document.getElementById('cardInputNumber');
  const cardInputName   = document.getElementById('cardInputName');
  const cardInputExpiry = document.getElementById('cardInputExpiry');
  const cardNetworkIcon = document.getElementById('cardNetworkIcon');

  function formatCardNumber(v) {
    return v.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();
  }

  if (cardInputNumber) {
    cardInputNumber.addEventListener('input', () => {
      const raw = cardInputNumber.value.replace(/\D/g, '');
      cardInputNumber.value = formatCardNumber(cardInputNumber.value);
      const preview = document.getElementById('cardPreviewNumber');
      if (preview) {
        const masked = (raw.substring(0, 12).replace(/./g, '•').replace(/(.{4})/g, '$1 ') + raw.substring(12, 16)).trim();
        preview.textContent = masked || '•••• •••• •••• ####';
      }
      if (cardNetworkIcon) {
        if (raw.startsWith('4')) cardNetworkIcon.className = 'fa-brands fa-cc-visa card-network-icon';
        else if (raw.startsWith('5')) cardNetworkIcon.className = 'fa-brands fa-cc-mastercard card-network-icon';
        else if (raw.startsWith('6')) cardNetworkIcon.className = 'fa-brands fa-cc-discover card-network-icon';
        else if (raw.startsWith('3')) cardNetworkIcon.className = 'fa-brands fa-cc-amex card-network-icon';
        else cardNetworkIcon.className = 'fa-regular fa-credit-card card-network-icon';
      }
    });
  }
  if (cardInputName) {
    cardInputName.addEventListener('input', () => {
      const preview = document.getElementById('cardPreviewName');
      if (preview) preview.textContent = (cardInputName.value.toUpperCase()) || 'CARD HOLDER';
    });
  }
  if (cardInputExpiry) {
    cardInputExpiry.addEventListener('input', () => {
      let v = cardInputExpiry.value.replace(/\D/g, '');
      if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2,4);
      cardInputExpiry.value = v;
      const preview = document.getElementById('cardPreviewExpiry');
      if (preview) preview.textContent = cardInputExpiry.value || 'MM/YY';
    });
  }

  // -----------------------------------------------------------------------
  // UPI VERIFY BUTTON
  // -----------------------------------------------------------------------
  const verifyUpiBtn = document.getElementById('verifyUpiBtn');
  if (verifyUpiBtn) {
    verifyUpiBtn.addEventListener('click', () => {
      const upiVal = (document.getElementById('customUpiInput') || {}).value || '';
      if (!upiVal.includes('@')) {
        showToast('Please enter a valid UPI ID (e.g. name@bank)');
        return;
      }
      verifyUpiBtn.textContent = 'Verifying...';
      verifyUpiBtn.disabled = true;
      setTimeout(() => {
        verifyUpiBtn.textContent = '✓ Verified';
        verifyUpiBtn.style.color = '#22c55e';
        verifyUpiBtn.style.borderColor = '#22c55e';
        // Set as selected payment method
        showToast(`UPI ID ${upiVal} verified successfully!`);
        playBeep(880, 0.1);
        setTimeout(() => {
          verifyUpiBtn.textContent = 'Verify ID';
          verifyUpiBtn.disabled = false;
          verifyUpiBtn.style.color = '';
          verifyUpiBtn.style.borderColor = '';
        }, 2500);
      }, 1200);
    });
  }

  // -----------------------------------------------------------------------
  // FARE CALCULATOR (Tab 3)
  // -----------------------------------------------------------------------
  const calcSlider = document.getElementById('calcDurationSlider');
  const calcVehSel = document.getElementById('calcVehicleTypeSelect');
  const calcEvChk  = document.getElementById('calcEvChargingCheck');

  function updateCalcDisplay() {
    if (!calcSlider) return;
    const hours = parseInt(calcSlider.value, 10);
    const sliderText = document.getElementById('calcSliderValueText');
    if (sliderText) sliderText.textContent = hours === 1 ? '1 Hour' : `${hours} Hours`;

    const vType = calcVehSel ? calcVehSel.value : 'Car';
    const rateMap = { Car: 20, SUV: 25, Motorcycle: 10, EV: 20 };
    const rate = rateMap[vType] || 20;
    const evExtra = calcEvChk && calcEvChk.checked ? 30 : 0;
    const total = (hours * rate) + evExtra;

    const displayEl = document.getElementById('calcDisplayTotal');
    const breakEl   = document.getElementById('calcBreakdownText');
    if (displayEl) displayEl.textContent = `₹${total}`;
    if (breakEl) {
      let txt = `${hours} Hr${hours > 1 ? 's' : ''} @ ₹${rate}/hr`;
      if (evExtra) txt += ` + EV Supercharger (₹${evExtra})`;
      txt += ` = ₹${total}`;
      breakEl.textContent = txt;
    }
  }

  if (calcSlider) calcSlider.addEventListener('input', updateCalcDisplay);
  if (calcVehSel) calcVehSel.addEventListener('change', updateCalcDisplay);
  if (calcEvChk)  calcEvChk.addEventListener('change', updateCalcDisplay);
  updateCalcDisplay();

  // Apply Calculator Duration to Main Booking Form
  const calcApplyBtn = document.getElementById('calcApplyToBookingBtn');
  if (calcApplyBtn && calcSlider) {
    calcApplyBtn.addEventListener('click', () => {
      const hours = calcSlider.value;
      const durSelect = document.getElementById('parkingDurationSelect');
      if (durSelect) {
        // Find closest option
        const opts = Array.from(durSelect.options).map(o => parseInt(o.value));
        const closest = opts.reduce((prev, curr) => Math.abs(curr - hours) < Math.abs(prev - hours) ? curr : prev);
        durSelect.value = String(closest);
        updateFareEstimate();
      }
      // Switch to Map tab
      const mapTabBtn = document.getElementById('viewTabMapBtn');
      if (mapTabBtn) mapTabBtn.click();
      const bookCard = document.getElementById('bookingCard');
      if (bookCard) bookCard.scrollIntoView({ behavior: 'smooth' });
      showToast(`Duration set to ${hours} hour${hours > 1 ? 's' : ''} on booking form.`);
      playBeep(750, 0.1);
    });
  }

  // -----------------------------------------------------------------------
  // SLOT DIRECTORY SEARCH FILTER
  // -----------------------------------------------------------------------
  const dirSearchInput = document.getElementById('slotDirSearchInput');
  if (dirSearchInput) {
    dirSearchInput.addEventListener('input', () => {
      const q = dirSearchInput.value.toLowerCase();
      const rows = document.querySelectorAll('#slotDirectoryTableBody tr');
      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // Override payAndConfirmBtn to read from active payment pane
  const origPayBtn = document.getElementById('payAndConfirmBtn');
  if (origPayBtn) {
    origPayBtn.replaceWith(origPayBtn.cloneNode(true)); // remove old listener
    const newPayBtn = document.getElementById('payAndConfirmBtn');
    newPayBtn.addEventListener('click', () => {
      if (!pendingBookingData) return;

      // Determine selected method from active pane
      let selectedMethod = 'UPI';
      const activeCatTab = document.querySelector('.pay-cat-tab-btn.active');
      if (activeCatTab) {
        const tabId = activeCatTab.dataset.tab;
        if (tabId === 'upi') {
          const chk = document.querySelector('input[name="payMethod"]:checked');
          selectedMethod = chk ? chk.value : 'Google Pay';
        } else if (tabId === 'card') {
          selectedMethod = 'Credit/Debit Card';
        } else if (tabId === 'netbank') {
          const nbEl = document.getElementById('selectedNetBankName');
          const otherSel = document.getElementById('otherBanksSelect');
          selectedMethod = (otherSel && otherSel.value) ? otherSel.value : (nbEl ? nbEl.value : 'Net Banking');
        } else if (tabId === 'fastag') {
          const walletChk = document.querySelector('input[name="payMethod"]:checked');
          selectedMethod = walletChk ? walletChk.value : 'FASTag';
        } else if (tabId === 'cash') {
          const activeExit = document.querySelector('.exit-opt-card.active');
          selectedMethod = activeExit ? activeExit.dataset.cashType : 'Pay at Exit';
        }
      }

      const pbr = el('paymentBtnRow');
      const pps = el('paymentProcessingState');
      if (pbr) pbr.classList.add('hidden');
      if (pps) pps.classList.remove('hidden');

      const statusTxt = document.getElementById('payProcessStatusText');
      const subTxt    = document.getElementById('payProcessSubText');
      if (statusTxt) statusTxt.textContent = `Authorizing via ${selectedMethod}...`;
      if (subTxt) subTxt.textContent = 'Connecting to secure payment gateway. Please do not close.';

      playBeep(700, 0.1);

      setTimeout(() => {
        const pm = el('paymentModal');
        if (pm) pm.classList.add('hidden');
        if (pbr) pbr.classList.remove('hidden');
        if (pps) pps.classList.add('hidden');
        playBeep(880, 0.2);

        const startTime = Date.now();
        const endTime   = startTime + pendingBookingData.durationHours * 3600000;
        const passId    = 'PK-' + Math.floor(1000 + Math.random() * 9000);

        showToast(`✅ Payment of ₹${pendingBookingData.fee} via ${selectedMethod} Successful!`);
        speakVoice(`Payment approved. Driving to Slot ${pendingBookingData.slotId}.`);

        const mapCard = document.querySelector('.parking-map-card');
        if (mapCard) mapCard.scrollIntoView({ behavior: 'smooth' });

        animateCarDrive(pendingBookingData.slotId, () => {
          const newPass = {
            passId,
            slotId:         pendingBookingData.slotId,
            floor:          pendingBookingData.floor,
            vehiclePlate:   pendingBookingData.vehiclePlate,
            notes:          pendingBookingData.notes,
            durationHours:  pendingBookingData.durationHours,
            startTime, endTime,
            fee:            pendingBookingData.fee,
            isEvCharging:   pendingBookingData.isEvCharging,
            batteryPct:     pendingBookingData.isEvCharging ? 42 : null,
            energyDelivered:pendingBookingData.isEvCharging ? 8.2 : null,
            paymentMethod:  selectedMethod
          };

          currentBookedPass = newPass;
          localStorage.setItem(getActivePassKey(), JSON.stringify(newPass));

          selectedSlotId = null;
          pendingBookingData = null;
          const csi = el('chosenSlotInput');
          const csb = el('chosenSlotBadge');
          const bni = el('bookingNotesInput');
          if (csi) csi.value = '';
          if (csb) csb.textContent = 'None';
          if (bni) bni.value = '';

          showToast(`🎉 Slot ${newPass.slotId} confirmed! Your digital pass is ready.`);
          speakVoice(`Parking at slot ${newPass.slotId} is confirmed. Redirecting to your pass.`);
          setTimeout(() => window.location.href = 'pass.html', 1000);
        });
      }, 1400);
    });
  }
}


// ==========================================================================
// SLOT DIRECTORY RENDERER (Tab 2 on map page)
// ==========================================================================
function renderSlotDirectory() {
  const tbody = document.getElementById('slotDirectoryTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rateMap = { Car: 20, SUV: 20, EV: 20, Bike: 10 };

  Object.entries(floorLotsData).forEach(([floor, data]) => {
    const allSlots = [...(data.rowA || []), ...(data.rowB || []), ...(data.rowC || [])];
    allSlots.forEach(slot => {
      const rate = rateMap[slot.type] || 20;
      const isUserBooked = currentBookedPass &&
        currentBookedPass.slotId === slot.id &&
        currentBookedPass.floor === floor;

      let catBadge = `<span class="slot-badge-type badge-car"><i class="fa-solid fa-car-side"></i> Car</span>`;
      if (slot.type === 'EV')   catBadge = `<span class="slot-badge-type badge-ev"><i class="fa-solid fa-bolt"></i> EV</span>`;
      if (slot.type === 'Bike') catBadge = `<span class="slot-badge-type badge-bike"><i class="fa-solid fa-motorcycle"></i> Bike</span>`;
      if (slot.type === 'SUV')  catBadge = `<span class="slot-badge-type badge-car"><i class="fa-solid fa-truck-pickup"></i> SUV</span>`;

      let statusPill = `<span class="slot-status-pill pill-avail">Available</span>`;
      if (isUserBooked) statusPill = `<span class="slot-status-pill" style="background:rgba(234,179,8,0.15);color:#eab308;">Your Spot</span>`;
      else if (slot.status === 'occupied') statusPill = `<span class="slot-status-pill pill-occ">Occupied</span>`;

      const actionBtn = (slot.status === 'available' && !isUserBooked)
        ? `<button class="btn btn-xs btn-outline" onclick="selectSlotFromDirectory('${slot.id}','${floor}')">
             <i class="fa-solid fa-crosshairs"></i> Select
           </button>`
        : `<span style="font-size:0.75rem;color:var(--text-muted);">${isUserBooked ? 'Active' : '—'}</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${slot.id}</strong></td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${floor}</td>
        <td>${catBadge}</td>
        <td>${statusPill}</td>
        <td>₹${rate}/hr</td>
        <td>${actionBtn}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

window.selectSlotFromDirectory = function(slotId, floor) {
  // Switch to map tab
  const mapTabBtn = document.getElementById('viewTabMapBtn');
  if (mapTabBtn) mapTabBtn.click();

  // Set the floor
  const levelTabBtns = document.querySelectorAll('.level-tab-btn');
  levelTabBtns.forEach(b => {
    if (b.dataset.floor === floor) {
      b.click();
    }
  });

  // Set selected slot
  selectedSlotId = slotId;
  const csi = el('chosenSlotInput');
  const csb = el('chosenSlotBadge');
  if (csi) csi.value = slotId;
  if (csb) csb.textContent = slotId;
  renderParkingLotMap();
  updateFareEstimate();
  playBeep(720, 0.08);
  showToast(`Slot ${slotId} on ${floor} selected from directory!`);

  const bookCard = el('bookingCard');
  if (bookCard) bookCard.scrollIntoView({ behavior: 'smooth' });
};

// ==========================================================================
// I18N — MULTI-LANGUAGE SYSTEM (English, Hindi, Punjabi, Tamil)
// ==========================================================================
const I18N_STORAGE_KEY = 'where_did_i_park_lang_v1';

const TRANSLATIONS = {
  en: {
    lang_label: 'English',
    brand_tagline: 'Smart Parking & Slot Booking',
    welcome: 'Welcome',
    welcome_sub: 'Sign in to access your interactive parking map, active spot pass, garage, and history.',
    sign_in: 'Sign In',
    new_reg: 'New Rider Registration',
    email_phone: 'Email or Phone Number',
    password: 'Password',
    sign_in_btn: 'Sign In to Parking Portal',
    one_click_demo: 'One-Click Demo Rider Login',
    full_name: 'Full Name',
    mobile_no: 'Mobile Number',
    primary_vehicle: 'Primary Vehicle',
    model_plate: 'Vehicle Model & Plate Number',
    create_pwd: 'Create Password',
    reg_btn: 'Register & Enter Parking Lot',
    voice_on: 'Voice ON',
    voice_off: 'Muted',
    theme_light: 'Light Mode',
    theme_dark: 'Dark Mode',
    sign_out: 'Sign Out',
    nav_map: '1. Map & Book',
    nav_pass: '2. Active Pass',
    nav_garage: '3. My Garage',
    nav_history: '4. History',
    nav_payment: '5. Payment',
    tab_map_view: '🗺️ Lot Layout View',
    tab_directory_view: '📋 Slot Directory',
    tab_calc_view: '🧮 Fare Calculator',
    tab_rules_view: 'ℹ️ Parking Guidelines',
    cat_all: 'All Bays',
    cat_ev: '⚡ EV Charging',
    cat_car: '🚗 Cars & Sedans',
    cat_bike: '🛵 Bikes & 2-Wheelers',
    map_title: 'Interactive Parking Lot Map',
    map_sub: 'Click any available green bay to select your spot, watch the car park animation, and confirm your booking.',
    map_card_title: 'Live Parking Lot Layout',
    map_card_sub: 'Click on any green spot to pick and book your parking slot',
    floor_ground: 'Ground Floor (G)',
    floor_b1: 'Basement 1 (B1)',
    floor_b2: 'Basement 2 (B2)',
    legend_avail: 'Available (Click to select)',
    legend_selected: 'Selected Spot',
    legend_user: 'Your Parked Ride',
    legend_occupied: 'Occupied',
    legend_ev: 'EV Charging Spot ⚡',
    book_title: 'Book Selected Parking Slot',
    book_sub: 'Choose duration, select vehicle, and proceed to payment',
    lbl_slot: 'Selected Parking Slot *',
    lbl_floor: 'Parking Floor Level',
    lbl_duration: 'Expected Parking Duration',
    lbl_vehicle: 'Vehicle for this Booking',
    lbl_ev_charge: 'Activate EV Supercharger Station (+₹30 flat charging fee)',
    lbl_notes: 'Landmark or Reminder Notes (Optional)',
    lbl_fare: 'Estimated Parking Fee:',
    btn_proceed_pay: 'Proceed to Payment & Confirm',
    checkout_title: 'Secure Parking Checkout',
    summary_slot: 'Parking Bay & Floor:',
    summary_vehicle: 'Duration & Vehicle:',
    summary_amount: 'Amount Payable:',
    pay_tab_upi: '📱 UPI & QR',
    pay_tab_card: '💳 Cards',
    pay_tab_netbank: '🏦 Net Banking',
    pay_tab_fastag: '⚡ FASTag',
    pay_tab_cash: '💵 Exit Cash',
    pay_scan_qr: 'Scan Dynamic UPI QR Code',
    pay_scan_desc: 'Scan using any UPI App (GPay, PhonePe, Paytm, BHIM) to pay instantly.',
    view_active_pass: 'View My Active Pass',
    page_step_1: 'Page 1 of 4 • Interactive Parking Bay',
  },
  hi: {
    lang_label: 'हिंदी',
    brand_tagline: 'स्मार्ट पार्किंग & स्लॉट बुकिंग',
    welcome: 'स्वागत है',
    welcome_sub: 'अपना इंटरेक्टिव पार्किंग मैप, एक्टिव पास, गैराज और हिस्ट्री देखने के लिए लॉगिन करें।',
    sign_in: 'लॉगिन करें',
    new_reg: 'नया राइडर रजिस्ट्रेशन',
    email_phone: 'ईमेल या फोन नंबर',
    password: 'पासवर्ड',
    sign_in_btn: 'पार्किंग पोर्टल में लॉगिन करें',
    one_click_demo: 'एक-क्लिक डेमो राइडर लॉगिन',
    full_name: 'पूरा नाम',
    mobile_no: 'मोबाइल नंबर',
    primary_vehicle: 'मुख्य वाहन',
    model_plate: 'वाहन मॉडल & प्लेट नंबर',
    create_pwd: 'पासवर्ड बनाएं',
    reg_btn: 'रजिस्टर करें & पार्किंग में प्रवेश करें',
    voice_on: 'वॉयस चालू',
    voice_off: 'म्यूट',
    theme_light: 'लाइट मोड',
    theme_dark: 'डार्क मोड',
    sign_out: 'साइन आउट',
    nav_map: '1. मैप & बुक करें',
    nav_pass: '2. एक्टिव पास',
    nav_garage: '3. मेरा गैराज',
    nav_history: '4. हिस्ट्री',
    nav_payment: '5. भुगतान (Payment)',
    tab_map_view: '🗺️ लॉट लेआउट व्यू',
    tab_directory_view: '📋 स्लॉट डायरेक्टरी',
    tab_calc_view: '🧮 किराया कैलकुलेटर',
    tab_rules_view: 'ℹ️ पार्किंग नियम',
    cat_all: 'सभी बे',
    cat_ev: '⚡ ईवी चार्जिंग',
    cat_car: '🚗 कार & सेडान',
    cat_bike: '🛵 बाइक & 2-व्हीलर',
    map_title: 'इंटरेक्टिव पार्किंग लॉट मैप',
    map_sub: 'कोई भी हरे बे पर क्लिक करें, कार एनिमेशन देखें और बुकिंग कन्फर्म करें।',
    map_card_title: 'लाइव पार्किंग लॉट लेआउट',
    map_card_sub: 'अपना पार्किंग स्लॉट चुनने के लिए किसी भी हरे स्पॉट पर क्लिक करें',
    floor_ground: 'ग्राउंड फ्लोर (G)',
    floor_b1: 'बेसमेंट 1 (B1)',
    floor_b2: 'बेसमेंट 2 (B2)',
    legend_avail: 'उपलब्ध (चुनने के लिए क्लिक करें)',
    legend_selected: 'चुना गया स्पॉट',
    legend_user: 'आपकी पार्क की गई गाड़ी',
    legend_occupied: 'भरा हुआ',
    legend_ev: 'ईवी चार्जिंग स्पॉट ⚡',
    book_title: 'चुने हुए पार्किंग स्लॉट को बुक करें',
    book_sub: 'अवधि चुनें, वाहन चुनें और भुगतान करें',
    lbl_slot: 'चुना गया पार्किंग स्लॉट *',
    lbl_floor: 'पार्किंग फ्लोर लेवल',
    lbl_duration: 'पार्किंग की अपेक्षित अवधि',
    lbl_vehicle: 'इस बुकिंग के लिए वाहन',
    lbl_ev_charge: 'ईवी सुपरचार्जर स्टेशन सक्रिय करें (+₹30 फ्लैट चार्जिंग शुल्क)',
    lbl_notes: 'लैंडमार्क या रिमाइंडर नोट्स (वैकल्पिक)',
    lbl_fare: 'अनुमानित पार्किंग शुल्क:',
    btn_proceed_pay: 'भुगतान करें & कन्फर्म करें',
    checkout_title: 'सुरक्षित पार्किंग चेकआउट',
    summary_slot: 'पार्किंग बे & फ्लोर:',
    summary_vehicle: 'अवधि & वाहन:',
    summary_amount: 'देय राशि:',
    pay_tab_upi: '📱 UPI & QR',
    pay_tab_card: '💳 कार्ड',
    pay_tab_netbank: '🏦 नेट बैंकिंग',
    pay_tab_fastag: '⚡ FASTag',
    pay_tab_cash: '💵 बाहर निकलने पर भुगतान',
    pay_scan_qr: 'डायनामिक UPI QR कोड स्कैन करें',
    pay_scan_desc: 'तुरंत भुगतान के लिए कोई भी UPI ऐप (GPay, PhonePe, Paytm, BHIM) से स्कैन करें।',
    view_active_pass: 'मेरा एक्टिव पास देखें',
    page_step_1: 'पेज 1 of 4 • इंटरेक्टिव पार्किंग बे',
  },
  pa: {
    lang_label: 'ਪੰਜਾਬੀ',
    brand_tagline: 'ਸਮਾਰਟ ਪਾਰਕਿੰਗ & ਸਲੌਟ ਬੁਕਿੰਗ',
    welcome: 'ਜੀ ਆਇਆਂ ਨੂੰ',
    welcome_sub: 'ਆਪਣਾ ਇੰਟਰੈਕਟਿਵ ਪਾਰਕਿੰਗ ਮੈਪ, ਐਕਟਿਵ ਪਾਸ, ਗੈਰੇਜ ਅਤੇ ਇਤਿਹਾਸ ਦੇਖਣ ਲਈ ਲੌਗਿਨ ਕਰੋ।',
    sign_in: 'ਲੌਗਿਨ ਕਰੋ',
    new_reg: 'ਨਵਾਂ ਰਾਈਡਰ ਰਜਿਸਟ੍ਰੇਸ਼ਨ',
    email_phone: 'ਈਮੇਲ ਜਾਂ ਫੋਨ ਨੰਬਰ',
    password: 'ਪਾਸਵਰਡ',
    sign_in_btn: 'ਪਾਰਕਿੰਗ ਪੋਰਟਲ ਵਿੱਚ ਲੌਗਿਨ ਕਰੋ',
    one_click_demo: 'ਇੱਕ-ਕਲਿੱਕ ਡੈਮੋ ਰਾਈਡਰ ਲੌਗਿਨ',
    full_name: 'ਪੂਰਾ ਨਾਮ',
    mobile_no: 'ਮੋਬਾਈਲ ਨੰਬਰ',
    primary_vehicle: 'ਮੁੱਖ ਵਾਹਨ',
    model_plate: 'ਵਾਹਨ ਮਾਡਲ & ਪਲੇਟ ਨੰਬਰ',
    create_pwd: 'ਪਾਸਵਰਡ ਬਣਾਓ',
    reg_btn: 'ਰਜਿਸਟਰ ਕਰੋ & ਪਾਰਕਿੰਗ ਵਿੱਚ ਦਾਖਲ ਹੋਵੋ',
    voice_on: 'ਅਵਾਜ਼ ਚਾਲੂ',
    voice_off: 'ਮਿਊਟ',
    theme_light: 'ਲਾਈਟ ਮੋਡ',
    theme_dark: 'ਡਾਰਕ ਮੋਡ',
    sign_out: 'ਸਾਈਨ ਆਊਟ',
    nav_map: '1. ਮੈਪ & ਬੁੱਕ',
    nav_pass: '2. ਐਕਟਿਵ ਪਾਸ',
    nav_garage: '3. ਮੇਰਾ ਗੈਰੇਜ',
    nav_history: '4. ਇਤਿਹਾਸ',
    nav_payment: '5. ਭੁਗਤਾਨ (Payment)',
    tab_map_view: '🗺️ ਲਾਟ ਲੇਆਊਟ ਵਿਊ',
    tab_directory_view: '📋 ਸਲੌਟ ਡਾਇਰੈਕਟਰੀ',
    tab_calc_view: '🧮 ਕਿਰਾਇਆ ਕੈਲਕੁਲੇਟਰ',
    tab_rules_view: 'ℹ️ ਪਾਰਕਿੰਗ ਨਿਯਮ',
    cat_all: 'ਸਾਰੇ ਬੇ',
    cat_ev: '⚡ ਈਵੀ ਚਾਰਜਿੰਗ',
    cat_car: '🚗 ਕਾਰਾਂ',
    cat_bike: '🛵 ਬਾਈਕ',
    map_title: 'ਇੰਟਰੈਕਟਿਵ ਪਾਰਕਿੰਗ ਲਾਟ ਮੈਪ',
    map_sub: 'ਕੋਈ ਵੀ ਹਰੇ ਬੇ \'ਤੇ ਕਲਿੱਕ ਕਰੋ ਅਤੇ ਆਪਣੀ ਬੁਕਿੰਗ ਕਨਫਰਮ ਕਰੋ।',
    map_card_title: 'ਲਾਈਵ ਪਾਰਕਿੰਗ ਲਾਟ ਲੇਆਊਟ',
    map_card_sub: 'ਆਪਣਾ ਸਲੌਟ ਚੁਣਨ ਲਈ ਕਿਸੇ ਵੀ ਹਰੇ ਸਪੌਟ \'ਤੇ ਕਲਿੱਕ ਕਰੋ',
    floor_ground: 'ਗਰਾਊਂਡ ਫਲੋਰ (G)',
    floor_b1: 'ਬੇਸਮੈਂਟ 1 (B1)',
    floor_b2: 'ਬੇਸਮੈਂਟ 2 (B2)',
    legend_avail: 'ਉਪਲਬਧ (ਚੁਣਨ ਲਈ ਕਲਿੱਕ ਕਰੋ)',
    legend_selected: 'ਚੁਣਿਆ ਸਪੌਟ',
    legend_user: 'ਤੁਹਾਡਾ ਵਾਹਨ',
    legend_occupied: 'ਭਰਿਆ ਹੋਇਆ',
    legend_ev: 'ਈਵੀ ਚਾਰਜਿੰਗ ਸਪੌਟ ⚡',
    book_title: 'ਪਾਰਕਿੰਗ ਸਲੌਟ ਬੁੱਕ ਕਰੋ',
    book_sub: 'ਮਿਆਦ ਚੁਣੋ, ਵਾਹਨ ਚੁਣੋ ਅਤੇ ਭੁਗਤਾਨ ਕਰੋ',
    lbl_slot: 'ਚੁਣਿਆ ਪਾਰਕਿੰਗ ਸਲੌਟ *',
    lbl_floor: 'ਪਾਰਕਿੰਗ ਫਲੋਰ ਲੈਵਲ',
    lbl_duration: 'ਪਾਰਕਿੰਗ ਦੀ ਮਿਆਦ',
    lbl_vehicle: 'ਇਸ ਬੁਕਿੰਗ ਲਈ ਵਾਹਨ',
    lbl_ev_charge: 'ਈਵੀ ਸੁਪਰਚਾਰਜਰ ਸਟੇਸ਼ਨ ਕਿਰਿਆਸ਼ੀਲ ਕਰੋ (+₹30 ਫਲੈਟ)',
    lbl_notes: 'ਲੈਂਡਮਾਰਕ ਜਾਂ ਨੋਟਸ (ਵਿਕਲਪਿਕ)',
    lbl_fare: 'ਅਨੁਮਾਨਿਤ ਪਾਰਕਿੰਗ ਫੀਸ:',
    btn_proceed_pay: 'ਭੁਗਤਾਨ ਕਰੋ & ਕਨਫਰਮ ਕਰੋ',
    checkout_title: 'ਸੁਰੱਖਿਅਤ ਪਾਰਕਿੰਗ ਚੈੱਕਆਉਟ',
    summary_slot: 'ਪਾਰਕਿੰਗ ਬੇ & ਫਲੋਰ:',
    summary_vehicle: 'ਮਿਆਦ & ਵਾਹਨ:',
    summary_amount: 'ਦੇਣਯੋਗ ਰਾਸ਼ੀ:',
    pay_tab_upi: '📱 UPI & QR',
    pay_tab_card: '💳 ਕਾਰਡ',
    pay_tab_netbank: '🏦 ਨੈੱਟ ਬੈਂਕਿੰਗ',
    pay_tab_fastag: '⚡ FASTag',
    pay_tab_cash: '💵 ਬਾਹਰ ਨਿਕਲਣ \'ਤੇ ਭੁਗਤਾਨ',
    pay_scan_qr: 'ਡਾਇਨਾਮਿਕ UPI QR ਕੋਡ ਸਕੈਨ ਕਰੋ',
    pay_scan_desc: 'ਕਿਸੇ ਵੀ UPI ਐਪ ਨਾਲ ਸਕੈਨ ਕਰੋ।',
    view_active_pass: 'ਮੇਰਾ ਐਕਟਿਵ ਪਾਸ ਦੇਖੋ',
    page_step_1: 'ਪੇਜ 1 of 4 • ਇੰਟਰੈਕਟਿਵ ਪਾਰਕਿੰਗ ਬੇ',
  },
  ta: {
    lang_label: 'தமிழ்',
    brand_tagline: 'ஸ்மார்ட் பார்க்கிங் & ஸ்லாட் புக்கிங்',
    welcome: 'வரவேற்கிறோம்',
    welcome_sub: 'உங்கள் ஊடாடும் பார்க்கிங் வரைபடம், செயலில் உள்ள பாஸ், கேரேஜ் மற்றும் வரலாற்றை அணுக உள்நுழைக.',
    sign_in: 'உள்நுழைக',
    new_reg: 'புதிய ரைடர் பதிவு',
    email_phone: 'மின்னஞ்சல் அல்லது தொலைபேசி எண்',
    password: 'கடவுச்சொல்',
    sign_in_btn: 'பார்க்கிங் போர்டலில் உள்நுழைக',
    one_click_demo: 'ஒற்றை-கிளிக் டெமோ ரைடர் உள்நுழைவு',
    full_name: 'முழு பெயர்',
    mobile_no: 'மொபைல் எண்',
    primary_vehicle: 'முதன்மை வாகனம்',
    model_plate: 'வாகன மாதிரி & தட்டு எண்',
    create_pwd: 'கடவுச்சொல் உருவாக்கவும்',
    reg_btn: 'பதிவு செய்து பார்க்கிங்கில் நுழையவும்',
    voice_on: 'குரல் ஆன்',
    voice_off: 'மியூட்',
    theme_light: 'வெளிர் பயன்முறை',
    theme_dark: 'இருண்ட பயன்முறை',
    sign_out: 'வெளியேறு',
    nav_map: '1. வரைபடம் & புக்',
    nav_pass: '2. செயலில் பாஸ்',
    nav_garage: '3. என் கேரேஜ்',
    nav_history: '4. வரலாறு',
    nav_payment: '5. கட்டணம் (Payment)',
    tab_map_view: '🗺️ லாட் லேआட் காட்சி',
    tab_directory_view: '📋 ஸ்லாட் அட்டவணை',
    tab_calc_view: '🧮 கட்டண கணக்கீடு',
    tab_rules_view: 'ℹ️ பார்க்கிங் வழிமுறைகள்',
    cat_all: 'அனைத்து நிறுத்தங்கள்',
    cat_ev: '⚡ ஈவி சார்ஜிங்',
    cat_car: '🚗 கார்கள்',
    cat_bike: '🛵 இரு சக்கர வாகனங்கள்',
    map_title: 'ஊடாடும் பார்க்கிங் வரைபடம்',
    map_sub: 'ஏதேனும் பச்சை நிற நிறுத்தத்தை கிளிக் செய்து உங்கள் இடத்தை தேர்ந்தெடுக்கவும்.',
    map_card_title: 'நேரடி பார்க்கிங் வரைபடம்',
    map_card_sub: 'உங்கள் ஸ்லாட்டை தேர்ந்தெடுக்க பச்சை நிற இடத்தில் கிளிக் செய்யவும்',
    floor_ground: 'தரை தளம் (G)',
    floor_b1: 'அடித்தளம் 1 (B1)',
    floor_b2: 'அடித்தளம் 2 (B2)',
    legend_avail: 'கிடைக்கும் (தேர்ந்தெடுக்க கிளிக் செய்யவும்)',
    legend_selected: 'தேர்ந்தெடுக்கப்பட்ட இடம்',
    legend_user: 'உங்கள் வாகனம்',
    legend_occupied: 'நிரம்பியது',
    legend_ev: 'ஈவி சார்ஜிங் இடம் ⚡',
    book_title: 'தேர்ந்தெடுக்கப்பட்ட ஸ்லாட்டை புக் செய்யவும்',
    book_sub: 'காலம் தேர்வு செய்யவும், வாகனம் தேர்ந்தெடுக்கவும் மற்றும் கட்டணம் செலுத்தவும்',
    lbl_slot: 'தேர்ந்தெடுக்கப்பட்ட ஸ்லாட் *',
    lbl_floor: 'பார்க்கிங் தளம்',
    lbl_duration: 'பார்க்கிங் காலம்',
    lbl_vehicle: 'இந்த புக்கிங்கிற்கான வாகனம்',
    lbl_ev_charge: 'ஈவி சூப்பர்சார்ஜர் ஸ்டேஷன் இயக்கவும் (+₹30)',
    lbl_notes: 'குறிப்புகள் (விரும்பினால்)',
    lbl_fare: 'மதிப்பிடப்பட்ட கட்டணம்:',
    btn_proceed_pay: 'கட்டணம் செலுத்தி உறுதிப்படுத்தவும்',
    checkout_title: 'பாதுகாப்பான பார்க்கிங் செக்அவுட்',
    summary_slot: 'பார்க்கிங் நிறுத்தம் & தளம்:',
    summary_vehicle: 'காலம் & வாகனம்:',
    summary_amount: 'செலுத்த வேண்டிய தொகை:',
    pay_tab_upi: '📱 UPI & QR',
    pay_tab_card: '💳 அட்டைகள்',
    pay_tab_netbank: '🏦 நெட் பேங்கிங்',
    pay_tab_fastag: '⚡ FASTag',
    pay_tab_cash: '💵 வெளியேறும்போது கட்டணம்',
    pay_scan_qr: 'டைனமிக் UPI QR குறியீட்டை ஸ்கேன் செய்யவும்',
    pay_scan_desc: 'எந்த UPI பயன்பாட்டிலும் ஸ்கேன் செய்து உடனடியாக செலுத்தவும்.',
    view_active_pass: 'என் செயலில் பாஸ் காட்டு',
    page_step_1: 'பக்கம் 1 of 4 • ஊடாடும் பார்க்கிங் நிறுத்தம்',
  }
};

let currentLang = 'en';

function applyI18n(lang) {
  currentLang = lang;
  localStorage.setItem(I18N_STORAGE_KEY, lang);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) {
      el.textContent = t[key];
    }
  });

  // Update lang button label
  const lblEl = document.getElementById('currentLangLabel');
  if (lblEl) lblEl.textContent = t.lang_label || lang.toUpperCase();

  // Update html lang attribute
  document.documentElement.lang = lang;

  // Update voice assistant language
  const voiceBtn = document.getElementById('voiceToggleBtn');
  if (voiceBtn) {
    const sub = voiceBtn.querySelector('.btn-subtext');
    if (sub) sub.textContent = isVoiceEnabled ? (t.voice_on || 'Voice ON') : (t.voice_off || 'Muted');
  }

  // Update active lang option button styles
  document.querySelectorAll('.lang-opt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function initLanguageSelector() {
  // Load saved lang
  const savedLang = localStorage.getItem(I18N_STORAGE_KEY) || 'en';
  applyI18n(savedLang);

  // Toggle dropdown open/close
  const langBtn      = document.getElementById('langToggleBtn');
  const langMenu     = document.getElementById('langDropdownMenu');
  const langWrap     = document.getElementById('langSelectorWrap');

  if (!langBtn || !langMenu) return;

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !langMenu.classList.contains('hidden');
    if (isOpen) {
      langMenu.classList.add('hidden');
      langBtn.classList.remove('open');
    } else {
      langMenu.classList.remove('hidden');
      langBtn.classList.add('open');
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (langWrap && !langWrap.contains(e.target)) {
      langMenu.classList.add('hidden');
      langBtn.classList.remove('open');
    }
  });

  // Language option buttons
  document.querySelectorAll('.lang-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      applyI18n(lang);
      langMenu.classList.add('hidden');
      langBtn.classList.remove('open');
      showToast(`Language changed to ${TRANSLATIONS[lang].lang_label}`);
      playBeep(750, 0.07);

      // Update voice speech language
      if (lang === 'hi' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('भाषा बदली गई। धन्यवाद।');
        u.lang = 'hi-IN'; u.rate = 1.0;
        window.speechSynthesis.cancel();
        if (isVoiceEnabled) window.speechSynthesis.speak(u);
      } else if (lang === 'pa' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('ਭਾਸ਼ਾ ਬਦਲੀ ਗਈ।');
        u.lang = 'pa-IN'; u.rate = 1.0;
        window.speechSynthesis.cancel();
        if (isVoiceEnabled) window.speechSynthesis.speak(u);
      } else if (lang === 'ta' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('மொழி மாற்றப்பட்டது.');
        u.lang = 'ta-IN'; u.rate = 1.0;
        window.speechSynthesis.cancel();
        if (isVoiceEnabled) window.speechSynthesis.speak(u);
      } else {
        speakVoice('Language changed to English.');
      }
    });
  });
}

function updateFareEstimate() {

  const durSel = el('parkingDurationSelect');
  const evCb   = el('enableEvChargingCheckbox');
  const fareEl = el('estimatedFareText');
  if (!fareEl) return 0;
  const hours = parseInt(durSel ? durSel.value : '1', 10) || 1;
  const isEv  = evCb ? evCb.checked : false;
  const total = (hours * HOURLY_RATE) + (isEv ? EV_FLAT_FEE : 0);
  fareEl.textContent = `₹${total} (${hours} Hr${hours > 1 ? 's' : ''}${isEv ? ' + EV Supercharger' : ''})`;
  return total;
}

function renderParkingLotMap() {
  const floorData = floorLotsData[currentSelectedFloor];
  if (!floorData) return;
  renderRowSlots(floorData.rowA, el('rowASlotsGrid'));
  renderRowSlots(floorData.rowB, el('rowBSlotsGrid'));
  renderRowSlots(floorData.rowC, el('rowCSlotsGrid'));
}

function renderRowSlots(slots, container) {
  if (!container) return;
  container.innerHTML = '';
  slots.forEach(slot => {
    const slotEl = document.createElement('div');
    const nodeId = `slot_node_${slot.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    slotEl.id = nodeId;

    const isUserBooked = currentBookedPass &&
      currentBookedPass.slotId === slot.id &&
      currentBookedPass.floor  === currentSelectedFloor;
    const isSelected = selectedSlotId === slot.id;

    let statusClass = slot.status;
    if (isUserBooked) { statusClass = 'user-parked' + (currentBookedPass.isEvCharging ? ' ev-charging-active' : ''); }
    else if (isSelected) { statusClass = 'selected'; }
    slotEl.className = `parking-slot ${statusClass}`;

    let icon = 'fa-square-parking';
    if (slot.type === 'SUV')  icon = 'fa-truck-pickup';
    if (slot.type === 'EV')   icon = 'fa-bolt';
    if (slot.type === 'Bike') icon = 'fa-motorcycle';
    if (slot.status === 'occupied' && !isUserBooked) icon = 'fa-car-side';

    let statusText = slot.status.toUpperCase();
    if (isUserBooked) { statusText = currentBookedPass.isEvCharging ? '⚡ CHARGING' : 'YOUR SPOT'; }
    else if (isSelected) { statusText = 'CHOSEN'; }

    slotEl.innerHTML = `
      <div class="slot-title">${slot.id}</div>
      <i class="fa-solid ${icon} slot-icon"></i>
      <span class="slot-tag">${statusText}</span>
    `;

    slotEl.addEventListener('click', () => {
      if (slot.status === 'occupied' && !isUserBooked) {
        playBeep(300, 0.1);
        showToast(`Slot ${slot.id} is already taken by another vehicle.`);
        speakVoice(`Slot ${slot.id} is occupied.`);
        return;
      }
      if (isUserBooked) {
        showToast(`This is your current booked spot (${slot.id}).`);
        return;
      }
      selectedSlotId = slot.id;
      const csi = el('chosenSlotInput');
      const csb = el('chosenSlotBadge');
      if (csi) csi.value = slot.id;
      if (csb) csb.textContent = slot.id;
      if (slot.type === 'EV') {
        const evCb = el('enableEvChargingCheckbox');
        if (evCb) evCb.checked = true;
      }
      updateFareEstimate();
      playBeep(720, 0.08);
      renderParkingLotMap();
      showToast(`Slot ${slot.id} selected! Fill booking form below and proceed to payment.`);
      speakVoice(`Slot ${slot.id} selected on ${currentSelectedFloor}.`);
    });

    container.appendChild(slotEl);
  });
}

// Feature 1.1: Animated Car Drive
function animateCarDrive(targetSlotId, callback) {
  if (isAnimatingDrive) { if (callback) callback(); return; }
  isAnimatingDrive = true;

  const targetEl    = el(`slot_node_${targetSlotId.replace(/[^a-zA-Z0-9]/g, '_')}`);
  const schematic   = el('parkingSchematicArea');
  const entryMarker = el('entryGateMarker');
  const simCar      = el('simulatedCar');
  const simPlate    = el('simCarPlate');

  if (!targetEl || !schematic || !entryMarker || !simCar) {
    isAnimatingDrive = false;
    if (callback) callback();
    return;
  }

  const sr = schematic.getBoundingClientRect();
  const er = entryMarker.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();

  const startX = er.left - sr.left + (er.width / 2) - 24;
  const startY = er.top  - sr.top  + 6;
  const midY   = (tr.top - sr.top > 160) ? 210 : 90;
  const midX   = tr.left - sr.left + (tr.width / 2) - 24;
  const finalX = tr.left - sr.left + (tr.width / 2) - 24;
  const finalY = tr.top  - sr.top  + 8;

  if (simPlate) {
    simPlate.textContent = (pendingBookingData ? pendingBookingData.vehiclePlate : currentUser.plateNumber).split('-')[0].trim();
  }

  simCar.classList.remove('hidden');
  simCar.style.transition = 'none';
  simCar.style.left = `${startX}px`;
  simCar.style.top  = `${startY}px`;
  simCar.style.transform = 'rotate(90deg)';

  playCarParkSound();

  setTimeout(() => { simCar.style.transition = 'left 0.7s ease, top 0.7s ease, transform 0.4s ease'; simCar.style.top = `${midY}px`; }, 50);
  setTimeout(() => { simCar.style.transform = midX > startX ? 'rotate(0deg)' : 'rotate(180deg)'; simCar.style.left = `${midX}px`; }, 750);
  setTimeout(() => { simCar.style.transform = finalY > midY ? 'rotate(90deg)' : 'rotate(-90deg)'; simCar.style.top = `${finalY}px`; }, 1450);
  setTimeout(() => {
    simCar.style.transform = 'scale(0.95)';
    playBeep(980, 0.12);
    setTimeout(() => { simCar.classList.add('hidden'); isAnimatingDrive = false; if (callback) callback(); }, 600);
  }, 2200);
}

// ==========================================================================
// 11. PAGE: ACTIVE PASS (pass.html)
// ==========================================================================
let ticketCountdownInterval = null;
let evChargingInterval      = null;
let hasAlertedTenMinutes    = false;

function initPassPage() {
  let pass = null;
  try { pass = JSON.parse(localStorage.getItem(getActivePassKey())); } catch(e) {}

  const noPass  = el('noPassPlaceholder');
  const passCard= el('activeTicketCard');

  if (!pass) {
    if (noPass)  noPass.classList.remove('hidden');
    if (passCard) passCard.classList.add('hidden');
    // Update live dot
    const dot = el('navPassDot');
    if (dot) dot.classList.add('hidden');
    return;
  }

  currentBookedPass = pass;

  if (noPass)  noPass.classList.add('hidden');
  if (passCard) passCard.classList.remove('hidden');

  // Populate pass details
  const fields = {
    ticketPassId:    `PASS #${pass.passId}`,
    ticketSlotNo:    pass.slotId,
    ticketLevel:     pass.floor,
    ticketPlate:     pass.vehiclePlate,
    ticketEntryTime: formatTimeAgo(pass.startTime)
  };
  Object.entries(fields).forEach(([id, val]) => { if (el(id)) el(id).textContent = val; });

  const notesBox  = el('ticketNotesBox');
  const notesText = el('ticketNotesText');
  if (pass.notes && notesBox && notesText) {
    notesBox.classList.remove('hidden');
    notesText.textContent = pass.notes;
  } else if (notesBox) {
    notesBox.classList.add('hidden');
  }

  // Live dot
  const dot = el('navPassDot');
  if (dot) dot.classList.remove('hidden');

  // EV Charging Panel
  setupEvChargingPanel(pass);

  // Start countdown
  startCountdown();

  // Extend time buttons
  document.querySelectorAll('.extend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.getAttribute('data-mins'), 10);
      quickExtendTime(mins);
    });
  });

  // Print Receipt button
  const printBtn = el('printReceiptBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => openReceiptModal(pass));
  }

  // Share button
  const shareBtn = el('shareTicketBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const txt = `🅿️ Where Did I Park\nSlot: ${pass.slotId}\nFloor: ${pass.floor}\nVehicle: ${pass.vehiclePlate}\nPass: ${pass.passId}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'My Parking Pass', text: txt }); }
        catch(e) { navigator.clipboard.writeText(txt); showToast('Details copied to clipboard!'); }
      } else {
        navigator.clipboard.writeText(txt).then(() => showToast('Pass details copied to clipboard!'));
      }
    });
  }

  // Replay Drive btn (goes to map page)
  const replayBtn = el('replayDriveBtn');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      window.location.href = 'map.html';
    });
  }

  // Release Slot / Checkout
  const releaseBtn = el('releaseSlotBtn');
  if (releaseBtn) {
    releaseBtn.addEventListener('click', () => {
      if (!currentBookedPass) return;
      if (!confirm('Are you sure you want to checkout and release your parking slot?')) return;

      // Save to history
      const history = [];
      try { const h = localStorage.getItem(getHistoryKey()); if (h) history.push(...JSON.parse(h)); } catch(e) {}
      const record = { ...currentBookedPass, checkedOutAt: Date.now() };
      history.unshift(record);
      if (history.length > 10) history.pop();
      localStorage.setItem(getHistoryKey(), JSON.stringify(history));

      localStorage.removeItem(getActivePassKey());
      currentBookedPass = null;
      if (ticketCountdownInterval) clearInterval(ticketCountdownInterval);
      if (evChargingInterval)      clearInterval(evChargingInterval);

      playBeep(880, 0.2);
      showToast('Slot released! Visit History to view your receipt.');
      speakVoice('Parking completed. Have a safe journey!');
      setTimeout(() => window.location.href = 'history.html', 1200);
    });
  }

  // Receipt modal close buttons
  const closeRcpt = el('closeReceiptModalBtn');
  const closeSlip = el('closeSlipBtn');
  const printSlip = el('triggerPrintBtn');
  if (closeRcpt) closeRcpt.addEventListener('click', () => el('receiptModal') && el('receiptModal').classList.add('hidden'));
  if (closeSlip) closeSlip.addEventListener('click', () => el('receiptModal') && el('receiptModal').classList.add('hidden'));
  if (printSlip) printSlip.addEventListener('click', () => window.print());
}

function setupEvChargingPanel(pass) {
  const panel = el('ticketEvChargingPanel');
  if (!panel) return;
  if (!pass || !pass.isEvCharging) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  let battery = pass.batteryPct || 42;
  let energy  = pass.energyDelivered || 12.4;

  function updateEvUI() {
    const fill   = el('evBatteryFill');
    const pct    = el('evBatteryPct');
    const deliv  = el('evEnergyDelivered');
    const status = el('evChargingStatusTag');
    const ttf    = el('evTimeToFull');

    if (fill)   fill.style.width  = `${Math.min(100, battery)}%`;
    if (pct)    pct.textContent   = `${Math.round(battery)}%`;
    if (deliv)  deliv.textContent = `${energy.toFixed(1)} kWh`;

    if (battery >= 100) {
      if (status) { status.textContent = '✅ Battery Fully Charged (100%)'; status.style.color = '#10b981'; }
      if (ttf)    ttf.textContent = 'Completed';
      clearInterval(evChargingInterval);
      return;
    }
    const minsLeft = Math.max(1, Math.round((100 - battery) * 0.8));
    if (ttf)    ttf.textContent = `~${minsLeft} mins to full`;
    if (status) status.textContent = '⚡ Charging in progress...';
  }
  updateEvUI();
  if (evChargingInterval) clearInterval(evChargingInterval);
  evChargingInterval = setInterval(() => {
    if (battery < 100) {
      battery += 0.5; energy += 0.15;
      currentBookedPass.batteryPct = battery;
      currentBookedPass.energyDelivered = energy;
      localStorage.setItem(getActivePassKey(), JSON.stringify(currentBookedPass));
      updateEvUI();
    }
  }, 3000);
}

function startCountdown() {
  if (ticketCountdownInterval) clearInterval(ticketCountdownInterval);

  function tick() {
    if (!currentBookedPass) return;
    const remaining = currentBookedPass.endTime - Date.now();
    const timeEl    = el('ticketRemainingTime');
    const fillEl    = el('ticketProgressFill');
    const warnEl    = el('emergencyWarningBanner');

    if (remaining <= 0) {
      if (timeEl)  timeEl.textContent = '⚠️ EXPIRED — Please Return to Vehicle';
      if (fillEl)  { fillEl.style.width = '0%'; fillEl.style.background = '#ef4444'; }
      if (warnEl)  warnEl.classList.remove('hidden');
      clearInterval(ticketCountdownInterval);
      return;
    }

    // 10-min warning (Feature 4.2)
    if (remaining <= 600000) {
      if (warnEl) warnEl.classList.remove('hidden');
      if (!hasAlertedTenMinutes) {
        hasAlertedTenMinutes = true;
        playEmergencyAlertTone();
        showToast('⚠️ Alert: Less than 10 minutes left on your parking meter!');
        speakVoice('Attention. Your parking meter expires in less than 10 minutes.');
      }
    } else {
      if (warnEl) warnEl.classList.add('hidden');
    }

    const totalMs = currentBookedPass.durationHours * 3600000;
    const pct     = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
    if (fillEl)   fillEl.style.width = `${pct}%`;

    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    const p = n => String(n).padStart(2, '0');
    if (timeEl) timeEl.textContent = `${p(h)}h : ${p(m)}m : ${p(s)}s`;
  }

  tick();
  ticketCountdownInterval = setInterval(tick, 1000);
}

window.quickExtendTime = function(minutes) {
  if (!currentBookedPass) return;
  const extraFee = (minutes / 60) * HOURLY_RATE;
  currentBookedPass.endTime        += minutes * 60000;
  currentBookedPass.durationHours  += minutes / 60;
  currentBookedPass.fee            += extraFee;
  hasAlertedTenMinutes = false;
  const warnEl = el('emergencyWarningBanner');
  if (warnEl) warnEl.classList.add('hidden');
  localStorage.setItem(getActivePassKey(), JSON.stringify(currentBookedPass));
  playBeep(880, 0.15);
  showToast(`⏰ Time extended by +${minutes} Mins! New total: ₹${currentBookedPass.fee}`);
  speakVoice(`Parking extended by ${minutes} minutes.`);
};

function openReceiptModal(pass) {
  if (!pass) return;
  if (el('slipPassNum'))      el('slipPassNum').textContent      = `PASS #${pass.passId}`;
  if (el('slipRiderName'))    el('slipRiderName').textContent    = currentUser.fullName;
  if (el('slipPlateNum'))     el('slipPlateNum').textContent     = pass.vehiclePlate;
  if (el('slipSlotNum'))      el('slipSlotNum').textContent      = `Slot ${pass.slotId}`;
  if (el('slipFloor'))        el('slipFloor').textContent        = pass.floor;
  if (el('slipInTime'))       el('slipInTime').textContent       = formatDate(pass.startTime);
  if (el('slipOutTime'))      el('slipOutTime').textContent      = formatDate(pass.endTime);
  if (el('slipTotalAmount'))  el('slipTotalAmount').textContent  = `₹${pass.fee}.00 (${pass.paymentMethod || 'PAID'})`;
  const modal = el('receiptModal');
  if (modal) modal.classList.remove('hidden');
  playBeep(600, 0.05);
}

// ==========================================================================
// 12. PAGE: MY GARAGE / VEHICLES (vehicles.html)
// ==========================================================================
function initVehiclesPage() {
  renderGarageFleet();

  const form = el('garageAddVehicleForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type  = el('garageVehicleType') ? el('garageVehicleType').value : 'Car';
      const plate = el('garageVehiclePlate') ? el('garageVehiclePlate').value.trim() : '';

      if (!plate) { showToast('Please enter the vehicle model & plate number.'); return; }
      if (!currentUser.vehicles) currentUser.vehicles = [];
      if (currentUser.vehicles.some(v => v.plate.toLowerCase() === plate.toLowerCase())) {
        showToast('This vehicle is already in your garage.');
        return;
      }

      currentUser.vehicles.push({ type, plate });
      currentUser.plateNumber = plate;
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));

      // Update riders DB
      const riders = getRiders();
      const idx = riders.findIndex(r => r.email === currentUser.email);
      if (idx !== -1) { riders[idx].vehicles = currentUser.vehicles; riders[idx].plateNumber = plate; saveRiders(riders); }

      form.reset();
      showToast(`🚗 Vehicle "${plate}" added to your garage!`);
      speakVoice(`Vehicle ${plate.split('-')[0]} added.`);
      playBeep(720, 0.08);
      renderGarageFleet();
    });
  }
}

function renderGarageFleet() {
  const container  = el('garageFleetList');
  const countText  = el('garageCountText');
  const nameEl     = el('navUserName');
  const plateEl    = el('navUserPlate');
  if (!container) return;

  const vehicles = currentUser.vehicles || [];
  if (countText) countText.textContent = `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} in your garage`;
  container.innerHTML = '';

  if (vehicles.length === 0) {
    container.innerHTML = '<p style="padding:1rem;opacity:.6;">No vehicles yet. Add your first ride above!</p>';
    return;
  }

  vehicles.forEach((v, idx) => {
    const isActive = v.plate === currentUser.plateNumber;
    let iconCls = 'fa-car';
    if (v.type === 'EV')         iconCls = 'fa-bolt';
    if (v.type === 'Motorcycle') iconCls = 'fa-motorcycle';
    if (v.type === 'Scooter')    iconCls = 'fa-moped';
    if (v.type === 'SUV')        iconCls = 'fa-truck-pickup';

    const card = document.createElement('div');
    card.className = `fleet-vehicle-card ${isActive ? 'fleet-active' : ''}`;
    card.innerHTML = `
      <div class="fleet-icon"><i class="fa-solid ${iconCls}"></i></div>
      <div class="fleet-info">
        <strong>${v.plate}</strong>
        <span>${v.type}${isActive ? ' • <em>Active Ride</em>' : ''}</span>
      </div>
      <div class="fleet-actions">
        ${!isActive ? `<button class="btn btn-xs btn-primary" onclick="switchVehicle(${idx})"><i class="fa-solid fa-check"></i> Set Active</button>` : '<span class="active-badge"><i class="fa-solid fa-circle-check"></i> Active</span>'}
        <button class="btn btn-xs btn-outline-danger" onclick="removeVehicle(${idx})" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    container.appendChild(card);
  });
}

window.switchVehicle = function(idx) {
  currentUser.plateNumber = currentUser.vehicles[idx].plate;
  localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));
  const nameEl  = el('navUserPlate');
  if (nameEl) nameEl.textContent = currentUser.plateNumber;
  playBeep(680, 0.08);
  showToast(`Active vehicle switched to ${currentUser.plateNumber}`);
  speakVoice(`Vehicle switched to ${currentUser.vehicles[idx].plate.split('-')[0]}.`);
  renderGarageFleet();
};

window.removeVehicle = function(idx) {
  if (currentUser.vehicles.length === 1) { showToast('You must keep at least one vehicle.'); return; }
  const removed = currentUser.vehicles.splice(idx, 1)[0];
  if (currentUser.plateNumber === removed.plate) currentUser.plateNumber = currentUser.vehicles[0].plate;
  localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(currentUser));
  playBeep(350, 0.1);
  showToast(`Vehicle "${removed.plate}" removed from garage.`);
  renderGarageFleet();
};

// ==========================================================================
// 13. PAGE: HISTORY & RECEIPTS (history.html)
// ==========================================================================
function initHistoryPage() {
  let history = [];
  try { const h = localStorage.getItem(getHistoryKey()); if (h) history = JSON.parse(h); } catch(e) {}

  renderHistoryMetrics(history);
  renderHistoryList(history);

  const clearBtn = el('clearAllHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all past parking history?')) return;
      localStorage.removeItem(getHistoryKey());
      renderHistoryMetrics([]);
      renderHistoryList([]);
      showToast('Parking history cleared.');
    });
  }

  // Receipt modal buttons
  const closeRcpt = el('closeReceiptModalBtn');
  const closeSlip = el('closeSlipBtn');
  const printSlip = el('triggerPrintBtn');
  if (closeRcpt) closeRcpt.addEventListener('click', () => el('receiptModal') && el('receiptModal').classList.add('hidden'));
  if (closeSlip) closeSlip.addEventListener('click', () => el('receiptModal') && el('receiptModal').classList.add('hidden'));
  if (printSlip) printSlip.addEventListener('click', () => window.print());
}

function renderHistoryMetrics(history) {
  const totalS = el('metricTotalSessions');
  const totalH = el('metricTotalHours');
  const totalE = el('metricTotalSpent');
  if (totalS) totalS.textContent = history.length;
  if (totalH) totalH.textContent = `${history.reduce((a, h) => a + (h.durationHours || 0), 0).toFixed(1)} hrs`;
  if (totalE) totalE.textContent = `₹${history.reduce((a, h) => a + (h.fee || 0), 0)}`;
}

function renderHistoryList(history) {
  const wrapper  = el('historyListWrapper');
  const clearBtn = el('clearAllHistoryBtn');
  if (!wrapper) return;

  if (history.length === 0) {
    if (clearBtn) clearBtn.classList.add('hidden');
    wrapper.innerHTML = `
      <div class="history-empty-placeholder">
        <i class="fa-solid fa-car-tunnel"></i>
        <p>No previous parking history yet. Completed sessions will appear here.</p>
      </div>`;
    return;
  }

  if (clearBtn) clearBtn.classList.remove('hidden');
  wrapper.innerHTML = '';

  history.forEach((spot, idx) => {
    const row = document.createElement('div');
    row.className = 'history-item-row';
    row.innerHTML = `
      <div class="h-left">
        <div class="h-icon"><i class="fa-solid fa-square-parking"></i></div>
        <div class="h-text">
          <strong>${spot.floor} • Slot ${spot.slotId} ${spot.isEvCharging ? '⚡ EV' : ''}</strong>
          <small>${formatDate(spot.startTime)} • ${spot.vehiclePlate} (${spot.durationHours ? spot.durationHours.toFixed(1) : '?'}h — ₹${spot.fee})</small>
        </div>
      </div>
      <div class="h-actions">
        <button class="btn btn-xs btn-outline" onclick="printHistoryReceipt(${idx})" title="Print Receipt">
          <i class="fa-solid fa-receipt"></i> Print
        </button>
        <button class="btn btn-xs btn-outline-danger" onclick="deleteHistoryEntry(${idx})" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    wrapper.appendChild(row);
  });
}

window.printHistoryReceipt = function(idx) {
  let history = [];
  try { const h = localStorage.getItem(getHistoryKey()); if (h) history = JSON.parse(h); } catch(e) {}
  const spot = history[idx];
  if (!spot) return;
  openReceiptModal(spot);
};

window.deleteHistoryEntry = function(idx) {
  let history = [];
  try { const h = localStorage.getItem(getHistoryKey()); if (h) history = JSON.parse(h); } catch(e) {}
  history.splice(idx, 1);
  localStorage.setItem(getHistoryKey(), JSON.stringify(history));
  renderHistoryMetrics(history);
  renderHistoryList(history);
  showToast('Entry removed from history.');
  playBeep(400, 0.08);
};

// ==========================================================================
// 13.5 PAGE: SECURE PAYMENT GATEWAY (payment.html)
// ==========================================================================
function initPaymentPage() {
  initTheme();
  initVoice();
  initHeader();

  // Load pending booking data or fallback to defaults
  let bookingData = null;
  try {
    const raw = localStorage.getItem('where_did_i_park_pending_booking');
    if (raw) bookingData = JSON.parse(raw);
  } catch(e) {}

  if (!bookingData) {
    bookingData = {
      slotId: 'G-04',
      floor: 'Ground Floor (G)',
      vehiclePlate: currentUser ? currentUser.plateNumber : 'DL 01 AB 7788',
      durationHours: 2,
      isEvCharging: false,
      fee: 40
    };
  }

  // Populate Order Summary
  const slotEl      = el('checkoutSlotId');
  const floorEl     = el('checkoutFloorLevel');
  const plateEl     = el('checkoutVehiclePlate');
  const durEl       = el('checkoutDuration');
  const evEl        = el('checkoutEvStatus');
  const hoursEl     = el('calcHours');
  const baseFeeEl   = el('calcBaseFee');
  const evFeeEl     = el('calcEvFee');
  const totalEl     = el('checkoutTotalAmount');
  const payLabel    = el('paySubmitLabel');
  const fastagPlate = el('fastagVehiclePlate');

  const baseRate = (bookingData.durationHours || 1) * HOURLY_RATE;
  const evFee    = bookingData.isEvCharging ? EV_FLAT_FEE : 0;
  const totalAmt = bookingData.fee || (baseRate + evFee);

  if (slotEl)      slotEl.textContent      = `Slot ${bookingData.slotId} (${bookingData.floor || 'Ground Floor'})`;
  if (floorEl)     floorEl.textContent     = bookingData.floor || 'Ground Floor (G)';
  if (plateEl)     plateEl.textContent     = bookingData.vehiclePlate || (currentUser ? currentUser.plateNumber : 'DL 01 AB 7788');
  if (durEl)       durEl.textContent       = `${bookingData.durationHours} Hour${bookingData.durationHours > 1 ? 's' : ''}`;
  if (evEl)        evEl.textContent        = bookingData.isEvCharging ? 'Active 50kW DC Fast Charge (+₹30)' : 'Not Active';
  if (hoursEl)     hoursEl.textContent     = bookingData.durationHours;
  if (baseFeeEl)   baseFeeEl.textContent   = `₹${baseRate}`;
  if (evFeeEl)     evFeeEl.textContent     = `₹${evFee}`;
  if (totalEl)     totalEl.textContent     = `₹${totalAmt}`;
  if (payLabel)    payLabel.textContent    = `Authorize & Settle ₹${totalAmt}`;
  if (fastagPlate) fastagPlate.textContent = bookingData.vehiclePlate || (currentUser ? currentUser.plateNumber : 'DL 01 AB 7788');

  // Method Tab Switching
  const methodTabs = document.querySelectorAll('.method-tab');
  const panes = {
    upi:     el('paneUpi'),
    card:    el('paneCard'),
    netbank: el('paneNetbank'),
    fastag:  el('paneFastag'),
    cash:    el('paneCash')
  };

  let selectedMethod = 'UPI';

  methodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const method = tab.dataset.method;
      methodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      Object.keys(panes).forEach(k => {
        if (panes[k]) panes[k].classList.add('hidden');
      });
      if (panes[method]) panes[method].classList.remove('hidden');

      selectedMethod = method.toUpperCase();
      playBeep(540, 0.05);
    });
  });

  // Card Inputs Simulator Preview
  const cardNumInput    = el('cardNumInput');
  const cardNameInput   = el('cardNameInput');
  const cardExpiryInput = el('cardExpiryInput');
  const previewNum      = el('previewCardNum');
  const previewName     = el('previewCardHolder');
  const previewExpiry   = el('previewCardExpiry');

  if (cardNumInput && previewNum) {
    cardNumInput.addEventListener('input', (e) => {
      previewNum.textContent = e.target.value || '•••• •••• •••• 4242';
    });
  }
  if (cardNameInput && previewName) {
    cardNameInput.addEventListener('input', (e) => {
      previewName.textContent = (e.target.value || 'ALEX RIDER').toUpperCase();
    });
  }
  if (cardExpiryInput && previewExpiry) {
    cardExpiryInput.addEventListener('input', (e) => {
      previewExpiry.textContent = e.target.value || '12/28';
    });
  }

  // Quick App badges
  const appBadges = document.querySelectorAll('.quick-app-badge');
  appBadges.forEach(badge => {
    badge.addEventListener('click', () => {
      appBadges.forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      playBeep(600, 0.04);
      showToast(`Selected UPI app: ${badge.textContent.trim()}`);
    });
  });

  // UPI verification button
  const verifyUpiBtn = el('verifyUpiBtn');
  if (verifyUpiBtn) {
    verifyUpiBtn.addEventListener('click', () => {
      playBeep(780, 0.08);
      showToast('✅ UPI ID verified and linked to banking account!');
    });
  }

  // Pay Submit Button
  const submitBtn = el('paySubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const overlay    = el('paymentProcessState');
      const actionRow  = el('paymentActionRow');
      const methodTabsWrap = document.getElementById('payMethodTabs');
      const succCard   = el('paymentSuccessCard');

      if (actionRow) actionRow.classList.add('hidden');
      if (overlay)   overlay.classList.remove('hidden');
      playBeep(700, 0.1);

      setTimeout(() => {
        playBeep(880, 0.2);
        if (overlay) overlay.classList.add('hidden');
        if (methodTabsWrap) methodTabsWrap.classList.add('hidden');
        Object.keys(panes).forEach(k => { if (panes[k]) panes[k].classList.add('hidden'); });

        const startTime = Date.now();
        const endTime   = startTime + bookingData.durationHours * 3600000;
        const passId    = 'PK-' + Math.floor(1000 + Math.random() * 9000);

        const newPass = {
          passId,
          slotId:          bookingData.slotId,
          floor:           bookingData.floor,
          vehiclePlate:    bookingData.vehiclePlate,
          notes:           bookingData.notes || '',
          durationHours:   bookingData.durationHours,
          startTime, endTime,
          fee:             totalAmt,
          isEvCharging:    bookingData.isEvCharging,
          batteryPct:      bookingData.isEvCharging ? 45 : null,
          energyDelivered: bookingData.isEvCharging ? 8.5 : null,
          paymentMethod:   selectedMethod
        };

        // Save active pass
        localStorage.setItem(getActivePassKey(), JSON.stringify(newPass));

        // Save history item
        try {
          const histKey = getHistoryKey();
          const history = JSON.parse(localStorage.getItem(histKey)) || [];
          history.unshift({
            passId,
            slotId:       newPass.slotId,
            floor:        newPass.floor,
            vehiclePlate: newPass.vehiclePlate,
            date:         formatDate(startTime),
            timestamp:    startTime,
            duration:     `${newPass.durationHours} hrs`,
            durationHours:newPass.durationHours,
            fee:          totalAmt,
            paymentMode:  selectedMethod,
            status:       'Active'
          });
          localStorage.setItem(histKey, JSON.stringify(history));
        } catch(e) {}

        // Populate Success Card
        const sPass   = el('successPassId');
        const sSlot   = el('successSlot');
        const sAmount = el('successAmount');
        if (sPass)   sPass.textContent   = passId;
        if (sSlot)   sSlot.textContent   = `Slot ${bookingData.slotId} (${bookingData.floor})`;
        if (sAmount) sAmount.textContent = `₹${totalAmt}`;

        if (succCard) succCard.classList.remove('hidden');

        showToast(`✅ Payment of ₹${totalAmt} via ${selectedMethod} Successful!`);
        speakVoice(`Payment approved. Slot ${bookingData.slotId} is confirmed and reserved.`);
      }, 1400);
    });
  }
}

// ==========================================================================
// 14. MAIN ROUTER — DOMContentLoaded entry point
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'auth';

  // Language selector — init on all pages first
  initLanguageSelector();

  // Auth page: always init regardless
  if (page === 'auth') {
    initAuthPage();
    return;
  }

  // Protected pages — check session
  if (!loadCurrentUser()) {
    sessionStorage.setItem('auth_redirect_msg', 'Please sign in or use 1-click demo to access this parking module.');
    window.location.href = 'index.html#authSection';
    return;
  }

  // Shared header & theme & voice for all protected pages
  initTheme();
  initVoice();
  initHeader();

  // Route to page-specific init
  switch (page) {
    case 'map':      initMapPage();      break;
    case 'pass':     initPassPage();     break;
    case 'vehicles': initVehiclesPage(); break;
    case 'history':  initHistoryPage();  break;
    case 'payment':  initPaymentPage();  break;
  }

  console.log(`Where Did I Park — Page "${page}" loaded for ${currentUser.fullName}`);
});
