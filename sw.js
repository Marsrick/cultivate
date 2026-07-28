const CACHE_NAME = 'xiuxian-v8';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/audio.js',
    './js/data.js',
    './js/entities.js',
    './js/game.js',
    './js/joystick.js',
    './js/map.js',
    './js/storage.js',
    './assets/bg_underwater_ocean.png',
    './assets/bg_underwater_temple.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/apple-touch-icon.png',
    './favicon.ico'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching v3 assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 激活 Service Worker 并即时清空所有旧版本缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 网络优先策略 (Network-First) 确保最新修改即时拉取生效
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
