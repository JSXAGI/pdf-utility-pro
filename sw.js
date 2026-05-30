importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst } = workbox.strategies;

// UIリソースはキャッシュから優先的に読み込み
registerRoute(({request}) => request.destination === 'document' || request.destination === 'script',
  new NetworkFirst({ cacheName: 'static-resources' })
);

// インストール時にキャッシュをクリーンアップ
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('static-resources'));
});