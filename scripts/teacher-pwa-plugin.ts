import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
export function teacherPwa(): Plugin {
  return { name: 'progtalamid-teacher-pwa', generateBundle(_options, bundle) {
    const files = ['/', '/index.html', '/manifest.webmanifest', '/teacher-192.png', '/teacher-512.png', ...Object.keys(bundle).map((file) => `/${file}`)];
    const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16);
    const source = `const CACHE = 'progtalamid-teacher-shell-${version}';
const ASSETS = ${JSON.stringify([...new Set(files)])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('progtalamid-teacher-shell-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await Promise.race([fetch(event.request), new Promise((_, reject) => setTimeout(() => reject(new Error('offline')), 3000))]); }
      catch { return (await caches.open(CACHE)).match('/index.html'); }
    })());
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});`;
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  } };
}
