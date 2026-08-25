const CACHE_NAME = 'admin-dashboard-v1.0.0';
const OFFLINE_URL = 'https://accounts-legacyinstitute.github.io/aes-admin-dashboard/offline.html';
const CORE_ASSETS = [
    'https://accounts-legacyinstitute.github.io/aes-admin-dashboard/',
    'https://accounts-legacyinstitute.github.io/aes-admin-dashboard/offline.html',
    'https://accounts-legacyinstitute.github.io/aes-admin-dashboard/manifest.json',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-72x72_jvik7l.png',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-96x96_bil4j8.png',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-144x144_ct4nxh.png',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-192x192_ncvghb.png',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658071/li-admin-icon-512x512_dweacc.png',
    'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658754/li-admin-maskable-icon-512x512_k5wulg.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('script.google.com') ||
        url.hostname.includes('accounts.google.com') ||
        url.hostname.includes('res.cloudinary.com') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdn.jsdelivr.net')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (event.request.mode === 'navigate') return response;
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then((cached) => {
                        if (cached) return cached;
                        if (event.request.mode === 'navigate') return caches.match(OFFLINE_URL);
                        return new Response('', { status: 408 });
                    });
            })
    );
});

self.addEventListener('push', (event) => {
    const options = {
        body: 'New salary report available',
        icon: 'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-192x192_ncvghb.png',
        badge: 'https://res.cloudinary.com/dhkswq6td/image/upload/v1787658070/li-admin-icon-96x96_bil4j8.png'
    };
    event.waitUntil(
        self.registration.showNotification('Admin Dashboard', options)
    );
});