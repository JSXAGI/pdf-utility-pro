importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;

// 即時アップデートを強制
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// サイト構成ファイル（HTML/CSS/JS）は常に最新をチェックする（NetworkFirst）
registerRoute(
  ({request}) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style',
  new NetworkFirst({ cacheName: 'static-resources' })
);

// 画像関連はキャッシュ優先
registerRoute(
  ({request}) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })]
  })
);

// 外部ライブラリ（CDN）も最新を優先してトラブルを防ぐ
registerRoute(
  ({url}) => url.origin === 'https://esm.run' || url.origin === 'https://cdn.jsdelivr.net',
  new NetworkFirst({ cacheName: 'external-libs-cache' })
);