const CACHE_NAME = 'xiuxian-v30';
const MOTION_ASSETS = Array.from({ length: 10 }, (_, stageIdx) => (
    Array.from({ length: 8 }, (_, frameIdx) => `./assets/creatures_motion/stage_${stageIdx + 1}_frame_${frameIdx}.png`)
)).flat();
const MASTER_ASSETS = Array.from(
    { length: 10 },
    (_, stageIdx) => `./assets/creatures_motion_v25/masters/stage_${stageIdx + 1}_master.png`
);
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
    './assets/ui_generated/btn_start.png',
    './assets/ui_refined/avatar_player.png',
    './assets/ui_refined/btn_tasks.png',
    './assets/ui_refined/btn_biopedia.png',
    './assets/ui_refined/btn_growth.png',
    './assets/ui_refined/btn_skins.png',
    './assets/ui_refined/btn_start.png',
    './assets/ui_refined/title_logo.png',
    './assets/ui_refined/btn_settings.png',
    './assets/ui_refined/hero_koi_v2.png',
    './assets/ui_refined/icon_dash_v2.png',
    './assets/creatures/card_stage_1_tadpole.png',
    './assets/creatures/card_stage_2_fry.png',
    './assets/creatures/card_stage_10_kun.png',
    './assets/creatures/card_stage_5_puffer.png',
    './assets/creatures/card_stage_3_blackcarp.png',
    './assets/creatures/card_stage_7_eel.png',
    './assets/creatures/card_stage_7_dolphin.png',
    './assets/creatures/card_stage_8_shark.png',
    './assets/creatures/card_stage_9_dragon.png',
    './assets/creatures/card_stage_6_squid.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/apple-touch-icon.png',
    './favicon.ico',
    ...MOTION_ASSETS,
    ...MASTER_ASSETS
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching v30 assets');
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
