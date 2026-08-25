// PWA Installation Logic for Attendance System
(function () {
    let deferredPrompt = null;
    let isInstalled = false;

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        isInstalled = true;
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install popup after 3 seconds if not installed
        if (!isInstalled) {
            setTimeout(() => showInstallPopup(), 3000);
        }
    });

    // Show install popup
    function showInstallPopup() {
        const popup = document.createElement('div');
        popup.className = 'install-popup-overlay';
        popup.innerHTML = `
      <div class="install-popup">
        <div class="install-header">
          <img src="https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-96x96_bil4j8.png" alt="App Icon" class="install-icon">
          <div>
            <h3>Install Admin Dashboard System</h3>
            <p>The Legacy Institute</p>
          </div>
          <button class="close-btn" onclick="this.closest('.install-popup-overlay').remove()">
            <i class='bx bx-x'></i>
          </button>
        </div>
        <div class="install-body">
          <p>Install this app for a fullscreen experience with quick access to generate salary report and create staff attendance summaries.</p>
          <ul>
            <li><i class='bx bx-check-circle'></i> Fullscreen experience</li>
            <li><i class='bx bx-check-circle'></i> Quick access from home screen</li>
            <li><i class='bx bx-check-circle'></i> Smooth Experience</li>
          </ul>
        </div>
        <button class="install-btn" id="installAppBtn">
          <i class='bx bx-download'></i>
          Install App
        </button>
      </div>
    `;

        popup.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      animation: fadeIn 0.3s ease;
    `;

        const popupContainer = popup.querySelector('.install-popup');
        popupContainer.style.cssText = `
      background: white;
      border-radius: 20px;
      padding: 25px;
      max-width: 400px;
      width: 90%;
      animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

        const header = popup.querySelector('.install-header');
        header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
    `;

        popup.querySelector('.install-icon').style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 12px;
    `;

        popup.querySelector('h3').style.cssText = `
      font-size: 18px;
      color: #1e293b;
      margin: 0;
    `;

        popup.querySelector('.install-header p').style.cssText = `
      font-size: 13px;
      color: #64748b;
      margin: 2px 0 0;
    `;

        popup.querySelector('.close-btn').style.cssText = `
      margin-left: auto;
      background: #f1f5f9;
      border: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
    `;

        popup.querySelector('.install-body').style.cssText = `
      margin-bottom: 20px;
    `;

        popup.querySelector('.install-body p').style.cssText = `
      color: #475569;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 10px;
    `;

        popup.querySelector('ul').style.cssText = `
      list-style: none;
      padding: 0;
    `;

        popup.querySelectorAll('li').forEach(li => {
            li.style.cssText = `
        padding: 5px 0;
        font-size: 13px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
      `;
            li.querySelector('i').style.color = '#8cb300';
        });

        popup.querySelector('.install-btn').style.cssText = `
      width: 100%;
      background: #8cb300;
      color: white;
      border: none;
      padding: 14px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.3s;
    `;

        document.body.appendChild(popup);

        popup.querySelector('#installAppBtn').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;

                if (result.outcome === 'accepted') {
                    deferredPrompt = null;
                    popup.remove();
                    showNotification('App installed successfully!', 'success', 'Installation Complete');
                }
            }
        });

        // Close on overlay click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.remove();
        });
    }

    // Check if already installed and redirect
    if (isInstalled) {
        console.log('App is running in standalone mode');
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('https://accounts-legacyinstitute.github.io/aes-admin-dashboard/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
})();