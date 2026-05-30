importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst } = workbox.strategies;

// 1. ドキュメントやスクリプトは「まずはネットワーク、ダメならキャッシュ」
registerRoute(
  ({request}) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style',
  new NetworkFirst({
    cacheName: 'static-resources',
  })
);

// 2. アイコンや画像は「キャッシュから読み込み、なければネットワーク」
registerRoute(
  ({request}) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
  })
);

// インストール時には何も消さない（キャッシュを維持する）
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});