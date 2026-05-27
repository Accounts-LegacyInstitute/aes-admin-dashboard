// Configuration
const GOOGLE_CLIENT_ID = '137477957854-prdi3poibskfgdi8kdcg2l2sae54e25b.apps.googleusercontent.com';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzqx97FZstV5-ahMN8C8ch9pC3dnxzYMidp6j9mD5sn4arUEYgnbLJZ7zMaQzZ1kzD4/exec';
const ADMIN_EMAIL = 'acc.legacyinstitute@gmail.com';

// State
let currentUser = null;
let isAuthenticated = false;
let isEmailVerified = false;
let isPasskeyVerified = false;
let verificationCode = '';
let codeSent = false;

// Initialize
function initApp() {
    checkAuthStatus();
    if (isAuthenticated && currentUser) {
        handlePostLogin();
    } else {
        renderLoginScreen();
    }
}

// Check auth status
function checkAuthStatus() {
    const token = localStorage.getItem('admin_token');
    const userData = localStorage.getItem('admin_user');
    const tokenExpiry = localStorage.getItem('admin_token_expiry');

    if (token && userData && tokenExpiry) {
        const now = new Date().getTime();
        if (now < parseInt(tokenExpiry)) {
            currentUser = JSON.parse(userData);
            isAuthenticated = true;
        } else {
            clearAuth();
        }
    }
}

// Clear auth
function clearAuth() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token_expiry');
    currentUser = null;
    isAuthenticated = false;
    isEmailVerified = false;
    isPasskeyVerified = false;
}

// Render login screen
function renderLoginScreen() {
    document.getElementById('mainContainer').innerHTML = `
    <div class="login-screen">
      <i class='bx bx-shield-quarter admin-icon'></i>
      <h1>Admin Dashboard</h1>
      <span class="admin-badge">🔒 Restricted Access</span>
      <p class="description">
        Secure administration panel for managing staff attendance records, 
        generating salary reports, and overseeing system operations.
      </p>
      <button class="google-login-btn" id="googleLoginBtn">
        <img src="https://www.google.com/favicon.ico" alt="Google" 
             onerror="this.src='https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png'">
        Sign in with Google
      </button>
    </div>
  `;

    document.getElementById('googleLoginBtn').addEventListener('click', initiateGoogleLogin);
}

// Google Login
function initiateGoogleLogin() {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'token',
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        state: 'admin-pass-through'
    });

    const width = 500, height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const popup = window.open(
        `${authUrl}?${params.toString()}`,
        'Google Login',
        `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup || popup.closed) {
        window.location.href = `${authUrl}?${params.toString()}`;
    } else {
        window.addEventListener('message', handleOAuthCallback, false);
    }
}

// Handle OAuth callback
function handleOAuthCallback(event) {
    if (event.data && event.data.type === 'oauth-callback') {
        handleAuthResponse(event.data.hash);
    }
}

// Handle auth response
async function handleAuthResponse(hash) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in') || '3600';

    if (accessToken) {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const userData = await response.json();

            const expiryTime = new Date().getTime() + (parseInt(expiresIn) * 1000);
            localStorage.setItem('admin_token', accessToken);
            localStorage.setItem('admin_token_expiry', expiryTime.toString());
            localStorage.setItem('admin_user', JSON.stringify(userData));

            sessionStorage.setItem('admin_fresh_login', 'true');

            currentUser = userData;
            isAuthenticated = true;

            handlePostLogin();
        } catch (error) {
            alert('Authentication failed. Please try again.');
            renderLoginScreen();
        }
    }
}

// Handle post-login flow
async function handlePostLogin() {
    // Check if user is admin
    if (currentUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        showUnauthorizedScreen();
        return;
    }

    // Check if this is a FRESH Google login (just authenticated)
    const isFreshLogin = sessionStorage.getItem('admin_fresh_login') === 'true';

    if (isFreshLogin) {
        // Clear the flag
        sessionStorage.removeItem('admin_fresh_login');
        // New login = require email verification
        showEmailVerification();
    } else {
        // Returning user with valid token = skip to passkey
        showPasskeyVerification();
    }
}

// Show email verification screen
function showEmailVerification() {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    container.innerHTML = `
    <div class="verification-content">
      <i class='bx bx-envelope email-icon'></i>
      <h2>Verify Your Email</h2>
      <p class="email-display">${currentUser.email}</p>
      <p class="description">
        A verification code will be sent to your admin email address. 
        Please enter the 8-digit code to continue accessing the admin dashboard.
      </p>
      <button class="send-code-btn" id="sendCodeBtn" onclick="sendVerificationCode()">
        <i class='bx bx-send'></i> Send Verification Code
      </button>
      <div id="codeInputSection" style="display:none; margin-top:20px; width:100%;"></div>
    </div>
  `;

    overlay.classList.add('active');
}

// Send verification code
async function sendVerificationCode() {
    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner"></span> Sending...';

    try {
        const url = `${APPS_SCRIPT_URL}?action=sendVerificationCode&email=${encodeURIComponent(currentUser.email)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            codeSent = true;
            showCodeInputSection();
        } else {
            alert(result.error || 'Failed to send code');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="bx bx-send"></i> Send Verification Code';
        }
    } catch (error) {
        alert('Connection error. Please try again.');
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="bx bx-send"></i> Send Verification Code';
    }
}

// Show code input section
function showCodeInputSection() {
    const section = document.getElementById('codeInputSection');
    section.style.display = 'block';
    section.innerHTML = `
    <p style="color: var(--success); font-weight: 500; margin-bottom: 15px;">
      <i class='bx bx-check-circle'></i> Code sent to ${currentUser.email}
    </p>
    <div class="code-inputs" id="codeInputs">
      ${Array(8).fill(0).map((_, i) =>
        `<input type="tel" class="code-input" id="code${i}" maxlength="1" 
         inputmode="numeric" pattern="[0-9]" oninput="handleCodeInput(${i})" 
         onkeydown="handleCodeKeydown(event, ${i})" autocomplete="off">`
    ).join('')}
    </div>
    <div class="button-group" style="margin-top: 20px;">
      <button class="btn btn-secondary" onclick="resendCode()">
        <i class='bx bx-refresh'></i> Resend Code
      </button>
      <button class="btn btn-primary" id="confirmCodeBtn" disabled onclick="verifyCode()">
        <i class='bx bx-check'></i> Confirm Code
      </button>
    </div>
    <p id="codeError" style="color: var(--danger); font-size: 13px; margin-top: 10px; display: none;"></p>
  `;

    // Focus first input
    setTimeout(() => document.getElementById('code0').focus(), 100);

    // Hide send button
    document.getElementById('sendCodeBtn').style.display = 'none';
}

// Handle code input
function handleCodeInput(index) {
    const input = document.getElementById(`code${index}`);
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;

    if (value) {
        input.classList.add('filled');
        // Move to next input
        if (index < 7) {
            document.getElementById(`code${index + 1}`).focus();
        }
    } else {
        input.classList.remove('filled');
    }

    // Check if all inputs filled
    checkAllInputsFilled();
}

// Handle keydown for backspace
function handleCodeKeydown(event, index) {
    if (event.key === 'Backspace' && !document.getElementById(`code${index}`).value && index > 0) {
        document.getElementById(`code${index - 1}`).focus();
    }
}

// Check all inputs filled
function checkAllInputsFilled() {
    let allFilled = true;
    for (let i = 0; i < 8; i++) {
        if (!document.getElementById(`code${i}`).value) {
            allFilled = false;
            break;
        }
    }

    document.getElementById('confirmCodeBtn').disabled = !allFilled;
}

// Resend code
async function resendCode() {
    const resendBtn = document.querySelector('.btn-secondary');
    resendBtn.disabled = true;
    resendBtn.innerHTML = '<span class="spinner"></span> Resending...';

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=sendVerificationCode&email=${encodeURIComponent(currentUser.email)}`);
        const result = await response.json();

        if (result.success) {
            verificationCode = result.code;
            // Clear inputs
            for (let i = 0; i < 8; i++) {
                document.getElementById(`code${i}`).value = '';
                document.getElementById(`code${i}`).classList.remove('filled');
            }
            document.getElementById('code0').focus();
            document.getElementById('confirmCodeBtn').disabled = true;

            // Show success message
            const errorEl = document.getElementById('codeError');
            errorEl.style.display = 'block';
            errorEl.style.color = 'var(--success)';
            errorEl.textContent = 'New code sent successfully!';
            setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
        }
    } catch (error) {
        alert('Failed to resend code.');
    } finally {
        resendBtn.disabled = false;
        resendBtn.innerHTML = '<i class="bx bx-refresh"></i> Resend Code';
    }
}

// Verify code
async function verifyCode() {
    let enteredCode = '';
    for (let i = 0; i < 8; i++) {
        enteredCode += document.getElementById(`code${i}`).value;
    }

    const errorEl = document.getElementById('codeError');
    const confirmBtn = document.getElementById('confirmCodeBtn');

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner"></span> Verifying...';

    try {
        const url = `${APPS_SCRIPT_URL}?action=verifyCode&email=${encodeURIComponent(currentUser.email)}&code=${enteredCode}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            isEmailVerified = true;
            document.getElementById('modalOverlay').classList.remove('active');
            showPasskeyVerification();
        } else {
            errorEl.style.display = 'block';
            errorEl.textContent = result.error || 'Invalid code';
            clearCodeInputs();
        }
    } catch (error) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'Verification failed. Please try again.';
        clearCodeInputs();
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="bx bx-check"></i> Confirm Code';
    }
}

function clearCodeInputs() {
    for (let i = 0; i < 8; i++) {
        document.getElementById(`code${i}`).value = '';
        document.getElementById(`code${i}`).classList.remove('filled');
    }
    document.getElementById('code0').focus();
    document.getElementById('confirmCodeBtn').disabled = true;
}

// Show passkey verification
const PASSKEY_GIFS = [
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1776421272/GIF_001_xoghff.gif',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1776421267/GIF_002_i2ch3v.gif',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1776421267/GIF_003_gy2k49.gif'
];

let gifAnimationInterval = null;
let currentGifIndex = 0;

function showPasskeyVerification() {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    const deviceId = getDeviceId();
    const passkeyRegistered = localStorage.getItem(`admin_passkey_${deviceId}`);

    overlay.classList.add('active');

    if (passkeyRegistered === 'true') {
        container.innerHTML = `
      <div class="modal-content verification-modal">
        <h2 class="modal-title">Verify It's You</h2>
        <p class="modal-description">Please verify your identity using your saved passkey for Admin Dashboard access.</p>
        
        <div class="animation-container">
          <i class='bx bx-shield-quarter verification-icon' id="verificationIcon"></i>
        </div>
        
        <button class="passkey-btn" id="verifyPasskeyBtn">
          <i class='bx bx-fingerprint' style="font-size: 24px;"></i>
          Verify with Passkey
        </button>
        
        <p class="skip-text" id="skipVerification">Having trouble? Try again later</p>
      </div>
    `;

        document.getElementById('verifyPasskeyBtn').addEventListener('click', verifyPasskey);
        document.getElementById('skipVerification').addEventListener('click', () => {
            clearAuth();
            overlay.classList.remove('active');
            renderLoginScreen();
        });

        if (isMobileDevice()) {
            setTimeout(verifyPasskey, 500);
        }
    } else {
        container.innerHTML = `
      <div class="modal-content">
        <h2 class="modal-title">Register a Passkey</h2>
        <p class="modal-description">Secure your admin dashboard access with a device passkey. This additional verification layer ensures only you can access sensitive administrative functions and maintains enterprise-grade security.</p>
        
        <div class="animation-container" id="animationContainer">
          <img src="${PASSKEY_GIFS[0]}" alt="Passkey Setup" class="passkey-gif active" id="gif1">
          <img src="${PASSKEY_GIFS[1]}" alt="Passkey Setup" class="passkey-gif" id="gif2">
          <img src="${PASSKEY_GIFS[2]}" alt="Passkey Setup" class="passkey-gif" id="gif3">
        </div>
        
        <button class="passkey-btn" id="registerPasskeyBtn">Register Passkey</button>
      </div>
    `;

        startGifAnimation();
        document.getElementById('registerPasskeyBtn').addEventListener('click', registerPasskey);
    }
}

function startGifAnimation() {
    const gifs = [
        document.getElementById('gif1'),
        document.getElementById('gif2'),
        document.getElementById('gif3')
    ];

    if (!gifs[0]) return;

    const timings = [3000, 6000, 5000];
    currentGifIndex = 0;

    function showNextGif() {
        if (!gifs[currentGifIndex]) return;

        const currentGif = gifs[currentGifIndex];
        const nextIndex = (currentGifIndex + 1) % gifs.length;
        const nextGif = gifs[nextIndex];

        currentGif.classList.add('zoom-out');

        setTimeout(() => {
            currentGif.classList.remove('active', 'zoom-out');
            nextGif.classList.add('active');
            currentGifIndex = nextIndex;
            gifAnimationInterval = setTimeout(showNextGif, timings[currentGifIndex]);
        }, 500);
    }

    gifAnimationInterval = setTimeout(showNextGif, timings[0]);
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Get device ID
function getDeviceId() {
    let deviceId = localStorage.getItem('admin_device_id');
    if (!deviceId) {
        deviceId = 'admin_device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('admin_device_id', deviceId);
    }
    return deviceId;
}

// Register passkey
async function registerPasskey() {
    try {
        if (!window.PublicKeyCredential) {
            throw new Error('WebAuthn not supported');
        }

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKey = {
            challenge: challenge,
            rp: { name: "Admin Dashboard", id: window.location.hostname },
            user: {
                id: new Uint8Array(16),
                name: currentUser.email,
                displayName: currentUser.name
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 },
                { type: "public-key", alg: -257 }
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                residentKey: "required"
            },
            timeout: 60000,
            attestation: "none"
        };

        const credential = await navigator.credentials.create({ publicKey });

        if (credential) {
            const deviceId = getDeviceId();
            localStorage.setItem(`admin_passkey_${deviceId}`, 'true');
            localStorage.setItem(`admin_passkey_cred_${deviceId}`, JSON.stringify({
                id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
                type: credential.type
            }));

            isPasskeyVerified = true;
            document.getElementById('modalOverlay').classList.remove('active');
            renderDashboard();
        }
    } catch (error) {
        console.error('Passkey registration failed:', error);
        alert('Passkey registration failed. Please try again.');
    }
}

// Verify passkey
async function verifyPasskey() {
    try {
        const deviceId = getDeviceId();
        const storedCred = JSON.parse(localStorage.getItem(`admin_passkey_cred_${deviceId}`));

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKey = {
            challenge: challenge,
            allowCredentials: [{
                id: Uint8Array.from(atob(storedCred.id), c => c.charCodeAt(0)),
                type: storedCred.type,
            }],
            userVerification: "required",
            timeout: 60000
        };

        const assertion = await navigator.credentials.get({ publicKey });

        if (assertion) {
            isPasskeyVerified = true;
            document.getElementById('modalOverlay').classList.remove('active');
            renderDashboard();
        }
    } catch (error) {
        console.error('Passkey verification failed:', error);
        alert('Passkey verification failed. Please try again.');
    }
}

// Show unauthorized screen
function showUnauthorizedScreen() {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    container.innerHTML = `
    <div class="unauthorized-content">
      <i class='bx bx-block warning-icon'></i>
      <h2>Unauthorized Access</h2>
      <p class="description">
        This admin dashboard is restricted to authorized administrators only.
        Your email (${currentUser.email}) does not have admin privileges.
      </p>
      <div class="button-group" style="margin-top: 20px;">
        <button class="btn btn-secondary" onclick="exitDashboard()">
          <i class='bx bx-exit'></i> Exit Dashboard
        </button>
        <button class="btn btn-primary" onclick="retryAdminLogin()">
          <i class='bx bx-refresh'></i> Retry with Admin Account
        </button>
      </div>
    </div>
  `;

    overlay.classList.add('active');
}

// Exit dashboard
function exitDashboard() {
    clearAuth();
    window.close();
    // Fallback if window.close() doesn't work
    document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-size:24px;">Dashboard closed. You can close this tab.</div>';
}

// Retry admin login
function retryAdminLogin() {
    clearAuth();
    document.getElementById('modalOverlay').classList.remove('active');
    renderLoginScreen();
}

// Render admin dashboard
function renderDashboard() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString('en-US', options);

    document.getElementById('mainContainer').innerHTML = `
    <!-- Sidebar navigation -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <img class="header-image" src="https://res.cloudinary.com/dhkswq6td/image/upload/v1765611889/Receipt_Format_hunxj7.png" alt="institute-logo">
        </div>
        <nav class="nav-menu">
            <div class="nav-item active" data-page="dashboard"><i class="fas fa-th-large"></i> Dashboard</div>
            <div class="nav-item" data-page="employees"><i class="fas fa-users"></i> All Employees</div>
            <div class="nav-item" data-page="salary"><i class="fas fa-user-plus"></i> Salary Reports</div>
            <div class="nav-item" data-page="attendance"><i class="fas fa-calendar-check"></i> Attendance Log</div>
            <div class="nav-item" data-page="performance"><i class="fas fa-chart-bar"></i> Performance</div>
            <div class="nav-item" data-page="settings"><i class="fas fa-cog"></i> Settings</div>
        </nav>
        <div class="sidebar-footer">
            <i class="far fa-circle"></i> Staff Management Admin Dashboard • <span>by Aaqib's DevDesk</span>
        </div>
    </aside>

    <!-- Main Dashboard -->
    <main class="main-content">
        <div class="top-bar">
            <div class="page-title">
                <h1>Staff Management Admin Dashboard</h1>
                <p><i class="far fa-calendar-alt"></i> ${formattedDate} · Real-time overview</p>
            </div>
            <div class="user-profile">
                <i class="far fa-bell"></i>
                <img src="${currentUser.picture || ''}" class="avatar" style="width:38px;height:38px;border-radius:50%;object-fit:cover;" 
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <div class="avatar" style="display:none;background:#0f172a;color:white;width:38px;height:38px;border-radius:50%;align-items:center;justify-content:center;font-weight:bold;">
                  ${(currentUser.name || 'A').charAt(0).toUpperCase()}
                </div>
                <span style="font-weight:500;">${currentUser.name || 'Admin'}<br><role>Dashboard Admin</role></span>
                <i class="fas fa-sign-out-alt" id="logoutAdminBtn" style="cursor:pointer;font-size:1rem;color:#ef4444;" title="Logout"></i>
            </div>
        </div>

        <!-- Stats overview -->
        <div class="stats-grid" id="statsGrid">
            <div class="stat-card">
                <div class="stat-info">
                    <h3>Total Staff</h3>
                    <div class="stat-number" id="totalStaff">--</div>
                    <span style="color:#16a34a; font-size:0.8rem;">Loading...</span>
                </div>
                <div class="stat-icon"><i class="fas fa-user-tie"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <h3>Sessions Today</h3>
                    <div class="stat-number" id="sessionsToday">--</div>
                    <span style="color:#2563eb; font-size:0.8rem;">Loading...</span>
                </div>
                <div class="stat-icon"><i class="fas fa-user-check"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <h3>Active Sessions</h3>
                    <div class="stat-number" id="activeSessions">--</div>
                    <span style="color:#d97706; font-size:0.8rem;">Loading...</span>
                </div>
                <div class="stat-icon"><i class="fas fa-plane-departure"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <h3>Last Report Generated</h3>
                    <div class="stat-number" id="lastReport">--</div>
                    <span style="color:#7c3aed; font-size:0.8rem;">Loading...</span>
                </div>
                <div class="stat-icon"><i class="fas fa-briefcase"></i></div>
            </div>
        </div>

        <!-- Charts and table row -->
        <div class="dashboard-row">
            <div class="card">
                <div class="card-header">
                    <h2>Staff by Role</h2>
                    <span class="badge">Current 2026</span>
                </div>
                <div class="chart-container">
                    <canvas id="deptChart" width="400" height="180"></canvas>
                </div>
                <div style="display:flex; justify-content:center; gap:24px; margin-top:12px; font-size:0.8rem; color:#475569;">
                    <span><span style="background:#2563eb; display:inline-block; width:10px; height:10px; border-radius:2px;"></span> Engineering</span>
                    <span><span style="background:#16a34a; display:inline-block; width:10px; height:10px;"></span> Marketing</span>
                    <span><span style="background:#d97706; display:inline-block; width:10px; height:10px;"></span> Sales</span>
                    <span><span style="background:#9333ea; display:inline-block; width:10px; height:10px;"></span> HR</span>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>Recent Sessions</h2>
                    <button class="btn-outline" id="viewAllBtn">View All <i class="fas fa-arrow-right"></i></button>
                </div>
                <table>
                    <thead>
                        <tr><th>Employee</th><th>Date</th><th>Status</th><th>Check-in</th></tr>
                    </thead>
                    <tbody id="recentSessionsBody">
                        <tr><td colspan="4" style="text-align:center;color:#94a3b8;">Loading sessions...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Team Performance and Onboarding -->
        <div class="dashboard-row">
            <div class="card">
                <div class="card-header">
                    <h2>Team Performance</h2>
                    <i class="fas fa-ellipsis-h" style="color:#64748b;"></i>
                </div>
                <table>
                    <thead>
                        <tr><th>Employee</th><th>Hours This Month</th><th>Sessions</th></tr>
                    </thead>
                    <tbody id="performanceBody">
                        <tr><td colspan="3" style="text-align:center;color:#94a3b8;">Loading performance data...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>Salary Generation</h2>
                    <span class="badge">Quick Actions</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; padding:10px 0;">
                    <button class="btn-outline" onclick="generateMonthlyReport()" style="width:100%;text-align:left;">
                        <i class="fas fa-file-invoice"></i> Generate Monthly Salary Report
                    </button>
                    <button class="btn-outline" onclick="exportAttendanceData()" style="width:100%;text-align:left;">
                        <i class="fas fa-download"></i> Export Attendance Data
                    </button>
                    <button class="btn-outline" onclick="viewStaffList()" style="width:100%;text-align:left;">
                        <i class="fas fa-list"></i> View All Staff Records
                    </button>
                </div>
            </div>
        </div>
    </main>
  `;

    addDashboardStyles();

    setupDashboardEvents();

    loadDashboardData();

    setTimeout(initChart, 300);
}

// Load salary generator
async function loadSalaryGenerator() {
    const contentDiv = document.getElementById('dynamicContent');
    contentDiv.style.display = 'block';
    contentDiv.innerHTML = `
    <h2><i class='bx bx-calculator'></i> Salary Generator</h2>
    <div class="staff-list" id="staffList">
      <p>Loading staff data...</p>
    </div>
  `;

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllStaffHours`);
        const result = await response.json();

        if (result.success && result.staff) {
            let html = '';
            result.staff.forEach(staff => {
                html += `
          <div class="staff-item">
            <div class="staff-info">
              <h4>${staff.name}</h4>
              <p>${staff.email}</p>
            </div>
            <div class="staff-hours">
              ${staff.totalHours} hrs this month
            </div>
          </div>
        `;
            });
            document.getElementById('staffList').innerHTML = html;
        }
    } catch (error) {
        document.getElementById('staffList').innerHTML = '<p style="color:red;">Failed to load staff data</p>';
    }
}

// Other dashboard functions
function loadStaffOverview() {
    const contentDiv = document.getElementById('dynamicContent');
    contentDiv.style.display = 'block';
    contentDiv.innerHTML = '<h2><i class="bx bx-group"></i> Staff Overview</h2><p>Coming soon...</p>';
}

function loadReports() {
    const contentDiv = document.getElementById('dynamicContent');
    contentDiv.style.display = 'block';
    contentDiv.innerHTML = '<h2><i class="bx bx-file"></i> Reports</h2><p>Coming soon...</p>';
}

function loadSettings() {
    const contentDiv = document.getElementById('dynamicContent');
    contentDiv.style.display = 'block';
    contentDiv.innerHTML = '<h2><i class="bx bx-cog"></i> Settings</h2><p>Coming soon...</p>';
}

// Logout admin
function logoutAdmin() {
    clearAuth();
    renderLoginScreen();
}

// Check OAuth callback on load
function checkOAuthCallback() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        handleAuthResponse(hash);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function addDashboardStyles() {
    const styleId = 'admin-dashboard-styles';
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
    .container {
      max-width: 100% !important;
      height: 100vh !important;
      border-radius: 0 !important;
      padding: 0 !important;
      background: #f4f6fa !important;
      display: flex !important;
      flex-direction: row !important;
    }
    
    .sidebar {
      width: 260px;
      background: #8cb300;
      color: #252525;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 12px rgba(0, 0, 0, 0.06);
      height: 100vh;
      flex-shrink: 0;
    }
    
    .sidebar-header {
      padding: 28px 20px 20px;
      font-size: 1.5rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(11, 11, 11, 0.08);
    }
    
    .header-image {
      max-width: 100%;
      height: auto;
    }
    
    .nav-menu {
      flex: 1;
      padding: 20px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 18px;
      border-radius: 10px;
      color: #222222;
      font-weight: 500;
      cursor: pointer;
      font-size: 0.95rem;
    }
    
    .nav-item i {
      width: 22px;
      font-size: 1.2rem;
      text-align: center;
    }
    
    .nav-item.active {
      background: #164f00;
      color: white;
      font-weight: 600;
    }
    
    .nav-item.active i { color: #ffffff; }
    
    .nav-item:not(.active):hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .sidebar-footer {
      padding: 20px 18px 28px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.85rem;
      color: #383838;
    }
    
    .main-content {
      flex: 1;
      padding: 24px 28px 32px;
      overflow-y: auto;
      background: #8cb3006c;
    }
    
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .page-title h1 {
      font-size: 1.9rem;
      font-weight: 650;
      color: #0f172a;
    }
    
    .page-title p {
      color: #475569;
      font-size: 0.9rem;
      margin-top: 4px;
    }
    
    .user-profile {
      display: flex;
      align-items: center;
      gap: 16px;
      background: white;
      padding: 8px 18px;
      border-radius: 40px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
      border: 1px solid #e2e8f0;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }
    
    .stat-card {
      background: white;
      border-radius: 18px;
      padding: 20px 18px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.02);
      border: 1px solid #edf2f7;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .stat-info h3 {
      font-size: 0.9rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 8px;
    }
    
    .stat-number {
      font-size: 2.3rem;
      font-weight: 700;
      color: #0f172a;
    }
    
    .stat-icon {
      background: #eef2ff;
      color: #1e3a8a;
      padding: 14px;
      border-radius: 14px;
      font-size: 1.7rem;
    }
    
    .dashboard-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    
    .card {
      background: white;
      border-radius: 20px;
      padding: 20px 20px 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.02);
      border: 1px solid #e9eef3;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    
    .card-header h2 {
      font-size: 1.2rem;
      font-weight: 650;
      color: #0f172a;
    }
    
    .badge {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 30px;
      font-weight: 600;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th {
      text-align: left;
      padding: 12px 6px 10px 0;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    
    td {
      padding: 12px 6px 12px 0;
      font-size: 0.9rem;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .status.present { background: #dcfce7; color: #15803d; }
    .status.away { background: #fef9c3; color: #854d0e; }
    .status.offline { background: #f1f5f9; color: #475569; }
    
    .chart-container {
      height: 240px;
      position: relative;
      margin-top: 10px;
    }
    
    .btn-outline {
      background: transparent;
      border: 1px solid #cbd5e1;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
    }
    
    .btn-outline:hover {
      background: #f1f5f9;
    }
    
    .progress-bar {
      width: 70px;
      height: 6px;
      background: #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: #2563eb;
    }
    
    .footer-note {
      margin-top: 16px;
      font-size: 0.8rem;
      color: #64748b;
    }
    
    hr {
      border: 0.5px solid #e9eef3;
      margin: 16px 0 8px;
    }
    
    @media (max-width: 1000px) {
      .dashboard-row { grid-template-columns: 1fr; }
      .container { flex-direction: column !important; }
      .sidebar { width: 100%; height: auto; }
    }
  `;
    document.head.appendChild(styleEl);
}

function setupDashboardEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');

            // Handle page switching
            const page = this.getAttribute('data-page');
            switch (page) {
                case 'dashboard':
                    showDashboard();
                    break;
                case 'salary':
                    showSalaryReports();
                    break;
                case 'employees':
                    // Future implementation
                    break;
                case 'attendance':
                    // Future implementation
                    break;
                case 'performance':
                    // Future implementation
                    break;
                case 'settings':
                    // Future implementation
                    break;
            }
        });
    });

    // Logout
    const logoutBtn = document.getElementById('logoutAdminBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutAdmin);
    }
}

function showDashboard() {
    // Remove salary section if exists
    const salarySection = document.getElementById('salarySection');
    if (salarySection) {
        salarySection.remove();
    }

    // Show dashboard elements
    document.querySelectorAll('.dashboard-row, .stats-grid').forEach(el => {
        el.style.display = '';
    });
}

async function loadDashboardData() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllStaffHours`);
        const result = await response.json();

        if (result.success && result.staff) {
            // Update stats
            document.getElementById('totalStaff').textContent = result.staff.length;

            // Count active sessions and sessions today
            let activeCount = 0;
            let todaySessions = 0;

            result.staff.forEach(s => {
                if (s.activeSession) activeCount++;
                if (s.todaySessions) todaySessions += s.todaySessions;
            });

            document.getElementById('sessionsToday').textContent = todaySessions;
            document.getElementById('activeSessions').textContent = activeCount;
            document.getElementById('lastReport').textContent = '5th';

            // Populate recent sessions
            const sessionsBody = document.getElementById('recentSessionsBody');
            const recentStaff = result.staff.slice(0, 5);

            if (recentStaff.length > 0) {
                sessionsBody.innerHTML = recentStaff.map(s => `
          <tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.lastDate || 'N/A'}</td>
            <td><span class="status ${s.activeSession ? 'present' : 'offline'}">${s.activeSession ? 'Active' : 'Offline'}</span></td>
            <td>${s.lastTimeIn || '—'}</td>
          </tr>
        `).join('');
            }

            // Populate performance
            const perfBody = document.getElementById('performanceBody');
            perfBody.innerHTML = result.staff.slice(0, 4).map(s => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(s.totalHours * 5, 100)}%"></div></div>
              ${s.totalHours}h
            </div>
          </td>
          <td>${s.sessionCount || 0} sessions</td>
        </tr>
      `).join('');
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function initChart() {
    const ctx = document.getElementById('deptChart')?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Engineering', 'Marketing', 'Sales', 'HR'],
            datasets: [{
                data: [102, 58, 63, 25],
                backgroundColor: ['#2563eb', '#16a34a', '#d97706', '#9333ea'],
                borderColor: 'white',
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            cutout: '65%',
        }
    });
}

function generateMonthlyReport() {
    alert('Salary report generation will be available soon.');
}

function exportAttendanceData() {
    alert('Export functionality coming soon.');
}

function viewStaffList() {
    alert('Staff list view coming soon.');
}

// Initialize
window.addEventListener('load', () => {
    checkOAuthCallback();
    initApp();
});

// Popup callback
if (window.opener) {
    window.opener.postMessage({
        type: 'oauth-callback',
        hash: window.location.hash
    }, '*');
    window.close();
}

// Salary Report Generator
function showSalaryReports() {
    // Hide all dashboard elements
    document.querySelectorAll('.dashboard-row, .stats-grid').forEach(el => {
        el.style.display = 'none';
    });

    // Remove existing salary section if any
    const existingSection = document.getElementById('salarySection');
    if (existingSection) {
        existingSection.remove();
    }

    // Create salary section
    const salarySection = document.createElement('div');
    salarySection.id = 'salarySection';
    salarySection.className = 'salary-generator-container';

    salarySection.innerHTML = `
    <div class="salary-hero">
      <img src="https://res.cloudinary.com/dhkswq6td/image/upload/v1765611889/Receipt_Format_hunxj7.png" 
           alt="Salary Report" style="width:120px; margin-bottom:20px;">
      <h2>Generate Salary Report</h2>
      <p>Generate reports and summarize staff salary details. Click 'Generate Report' below to generate a new Salary Report with different criteria applied.</p>
      <button class="generate-report-btn" onclick="openSalaryDialog()">
        <i class="fas fa-file-invoice"></i> Generate Report
      </button>
    </div>
  `;

    // Append to main content
    document.querySelector('.main-content').appendChild(salarySection);
}

// Open salary generation dialog
async function openSalaryDialog() {
    // Fetch roles and types
    const roles = await fetchUniqueRoles();
    const types = await fetchUniqueTypes();

    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    container.innerHTML = `
    <div class="salary-dialog">
      <h2>Generate Salary Report</h2>
      <p class="dialog-desc">Sort and Filter out the following fields according to criteria to generate a full Staff(s) Salary Report.</p>
      
      <div class="form-group">
        <label>Filter By Role:</label>
        <select id="filterRole" class="styled-select">
          <option value="">Select by Role</option>
          <option value="all">All Roles</option>
          ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label>Filter by Type:</label>
        <select id="filterType" class="styled-select">
          <option value="">Select by Type</option>
          <option value="all">FT & PT</option>
          ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="radio-label">
          <input type="radio" name="staffSelect" id="individualStaff" onchange="toggleIndividualStaff()">
          Generate Salary Report Individually for:
        </label>
        <select id="selectStaff" class="styled-select" disabled>
          <option value="">Select Staff</option>
        </select>
      </div>
      
      <div class="form-row">
        <div class="form-group half">
          <label>Date From:</label>
          <input type="date" id="dateFrom" class="styled-input date-input">
        </div>
        <div class="form-group half">
          <label>Date To:</label>
          <input type="date" id="dateTo" class="styled-input date-input">
        </div>
      </div>
      
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="sendToStaff">
          <div>
            <strong>Send Report to Staff via Email</strong>
            <p>Checking this checkbox will send the respective salary report detail(s) to the respective staff(s) via email.</p>
          </div>
        </label>
      </div>
      
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="sendCopy">
          <div>
            <strong>Send myself a Copy</strong>
            <p>Send the entire generated salary report to myself through email.</p>
          </div>
        </label>
      </div>
      
      <div class="dialog-note">
        <i class="fas fa-info-circle"></i>
        Clicking on the 'Generate Report' button will generate a salary report within the given date range and staff filtering.
      </div>
      
      <div class="dialog-buttons">
        <button class="btn-cancel" onclick="closeDialog()">Cancel</button>
        <button class="btn-generate" onclick="generateSalaryReport()">
          <i class="fas fa-cog"></i> Generate Report
        </button>
      </div>
    </div>
  `;

    overlay.classList.add('active');
}

// Toggle individual staff selection
async function toggleIndividualStaff() {
    const isIndividual = document.getElementById('individualStaff').checked;
    const staffSelect = document.getElementById('selectStaff');
    const filterRole = document.getElementById('filterRole');
    const filterType = document.getElementById('filterType');

    if (isIndividual) {
        staffSelect.disabled = false;
        filterRole.disabled = true;
        filterType.disabled = true;

        // Fetch all staff names
        const staff = await fetchAllStaffNames();
        staffSelect.innerHTML = '<option value="">Select Staff</option>' +
            staff.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    } else {
        staffSelect.disabled = true;
        filterRole.disabled = false;
        filterType.disabled = false;
        staffSelect.innerHTML = '<option value="">Select Staff</option>';
    }
}

// Generate salary report
async function generateSalaryReport() {
    const filterRole = document.getElementById('filterRole').value;
    const filterType = document.getElementById('filterType').value;
    const isIndividual = document.getElementById('individualStaff').checked;
    const selectStaff = document.getElementById('selectStaff').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const sendToStaff = document.getElementById('sendToStaff').checked;
    const sendCopy = document.getElementById('sendCopy').checked;

    // Validation
    if (!isIndividual && !filterRole) {
        alert('Please select a role filter.');
        return;
    }
    if (!isIndividual && !filterType) {
        alert('Please select a type filter.');
        return;
    }
    if (isIndividual && !selectStaff) {
        alert('Please select a staff member.');
        return;
    }
    if (!dateFrom || !dateTo) {
        alert('Please select date range.');
        return;
    }

    // Show progress dialog
    showProgressDialog();

    // Prepare data
    const params = new URLSearchParams();
    params.append('action', 'generateSalaryReport');
    params.append('filterRole', filterRole);
    params.append('filterType', filterType);
    params.append('isIndividual', isIndividual);
    params.append('staffName', selectStaff);
    params.append('dateFrom', dateFrom);
    params.append('dateTo', dateTo);
    params.append('sendToStaff', sendToStaff);
    params.append('sendCopy', sendCopy);
    params.append('adminEmail', currentUser.email);

    try {
        updateProgress(10, 'Initializing report generation...');

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: params
        });

        updateProgress(30, 'Processing staff data...');

        const result = await response.json();

        if (result.success) {
            updateProgress(70, 'Generating PDF report...');

            // Poll for completion
            await pollReportStatus(result.jobId);

            updateProgress(100, 'Report generated successfully!');

            setTimeout(() => {
                closeProgressDialog();
                closeDialog();
                alert('Salary report generated successfully!');
            }, 1500);
        } else {
            closeProgressDialog();
            alert('Error: ' + result.error);
        }
    } catch (error) {
        closeProgressDialog();
        alert('Failed to generate report: ' + error.message);
    }
}

// Show progress dialog
function showProgressDialog() {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    container.innerHTML = `
    <div class="progress-dialog">
      <h3>Generating Salary Report</h3>
      <p id="progressText">Initializing...</p>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" id="progressFill"></div>
      </div>
      <p class="progress-percent" id="progressPercent">0%</p>
    </div>
  `;

    overlay.classList.add('active');
}

// Update progress
function updateProgress(percent, text) {
    const fill = document.getElementById('progressFill');
    const percentEl = document.getElementById('progressPercent');
    const textEl = document.getElementById('progressText');

    if (fill) fill.style.width = percent + '%';
    if (percentEl) percentEl.textContent = percent + '%';
    if (textEl) textEl.textContent = text;
}

// Close progress dialog
function closeProgressDialog() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Poll report status
async function pollReportStatus(jobId) {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const response = await fetch(`${APPS_SCRIPT_URL}?action=checkReportStatus&jobId=${jobId}`);
        const result = await response.json();

        if (result.complete) {
            updateProgress(100, 'Report generation complete!');
            return;
        }

        updateProgress(30 + (attempts * 2), result.status || 'Processing...');
        attempts++;
    }
}

// Close dialog
function closeDialog() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Fetch unique roles
async function fetchUniqueRoles() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getUniqueRoles`);
        const result = await response.json();
        return result.success ? result.roles : [];
    } catch (e) {
        return [];
    }
}

// Fetch unique types
async function fetchUniqueTypes() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getUniqueTypes`);
        const result = await response.json();
        return result.success ? result.types : [];
    } catch (e) {
        return [];
    }
}

// Fetch all staff names
async function fetchAllStaffNames() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllStaffNames`);
        const result = await response.json();
        return result.success ? result.staff : [];
    } catch (e) {
        return [];
    }
}