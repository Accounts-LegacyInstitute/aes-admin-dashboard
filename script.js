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

            // Store auth
            const expiryTime = new Date().getTime() + (parseInt(expiresIn) * 1000);
            localStorage.setItem('admin_token', accessToken);
            localStorage.setItem('admin_token_expiry', expiryTime.toString());
            localStorage.setItem('admin_user', JSON.stringify(userData));

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
function handlePostLogin() {
    // Check if user is admin
    if (currentUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        showUnauthorizedScreen();
        return;
    }

    // Start email verification
    showEmailVerification();
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
        console.log('Sending code to:', url);

        const response = await fetch(url);
        const result = await response.json();
        console.log('Response:', result);

        if (result.success) {
            verificationCode = result.code;
            codeSent = true;
            showCodeInputSection();
        } else {
            alert('Failed: ' + (result.error || 'Unknown error'));
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="bx bx-send"></i> Send Verification Code';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Connection error: ' + error.message);
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
function verifyCode() {
    let enteredCode = '';
    for (let i = 0; i < 8; i++) {
        enteredCode += document.getElementById(`code${i}`).value;
    }

    const errorEl = document.getElementById('codeError');

    if (enteredCode === verificationCode) {
        isEmailVerified = true;
        document.getElementById('modalOverlay').classList.remove('active');
        showPasskeyVerification();
    } else {
        errorEl.style.display = 'block';
        errorEl.style.color = 'var(--danger)';
        errorEl.textContent = 'Invalid verification code. Please try again.';

        // Clear inputs
        for (let i = 0; i < 8; i++) {
            document.getElementById(`code${i}`).value = '';
            document.getElementById(`code${i}`).classList.remove('filled');
        }
        document.getElementById('code0').focus();
        document.getElementById('confirmCodeBtn').disabled = true;
    }
}

// Show passkey verification
function showPasskeyVerification() {
    const overlay = document.getElementById('modalOverlay');
    const container = document.getElementById('modalContainer');

    const deviceId = getDeviceId();
    const passkeyRegistered = localStorage.getItem(`admin_passkey_${deviceId}`);

    if (passkeyRegistered === 'true') {
        // Verify existing passkey
        container.innerHTML = `
      <div class="passkey-content">
        <i class='bx bx-fingerprint passkey-icon'></i>
        <h2>Verify Your Identity</h2>
        <p class="description">
          Please authenticate using your device passkey to access the admin dashboard.
        </p>
        <button class="send-code-btn" onclick="verifyPasskey()">
          <i class='bx bx-shield-quarter'></i> Verify with Passkey
        </button>
      </div>
    `;
    } else {
        // Register new passkey
        container.innerHTML = `
      <div class="passkey-content">
        <i class='bx bx-key passkey-icon'></i>
        <h2>Register a Passkey</h2>
        <p class="description">
          Set up a device passkey for secure access to the admin dashboard.
        </p>
        <button class="send-code-btn" onclick="registerPasskey()">
          <i class='bx bx-fingerprint'></i> Register Passkey
        </button>
      </div>
    `;
    }

    overlay.classList.add('active');
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
    document.getElementById('mainContainer').innerHTML = `
    <div class="dashboard-screen">
      <div class="dashboard-header">
        <h1><i class='bx bx-shield-quarter'></i> Admin Dashboard</h1>
        <div class="admin-profile">
          <img src="${currentUser.picture || 'default-avatar.png'}" alt="Admin">
          <div class="admin-info">
            <h3>${currentUser.name}</h3>
            <p>Administrator</p>
          </div>
          <button class="logout-btn" onclick="logoutAdmin()">
            <i class='bx bx-log-out'></i> Logout
          </button>
        </div>
      </div>
      
      <div class="dashboard-content">
        <div class="stat-card" onclick="loadSalaryGenerator()">
          <i class='bx bx-money'></i>
          <h3>Generate Salaries</h3>
          <p>Calculate and generate staff salary reports</p>
        </div>
        
        <div class="stat-card" onclick="loadStaffOverview()">
          <i class='bx bx-group'></i>
          <h3>Staff Overview</h3>
          <p>View all staff attendance records</p>
        </div>
        
        <div class="stat-card" onclick="loadReports()">
          <i class='bx bx-file'></i>
          <h3>Reports</h3>
          <p>Generate detailed attendance reports</p>
        </div>
        
        <div class="stat-card" onclick="loadSettings()">
          <i class='bx bx-cog'></i>
          <h3>Settings</h3>
          <p>Manage system configuration</p>
        </div>
      </div>
      
      <div id="dynamicContent" class="salary-section" style="display:none;"></div>
    </div>
  `;
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