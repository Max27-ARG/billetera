// Billetera Digital — guarda la app en el celular para que abra sin internet.
// Si cambiás algún archivo, subí el número de versión para que todos reciban la nueva.
const VERSION = 'billetera-v6';
const ARCHIVOS = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;            // lo que va a Google (POST) nunca se guarda
  const url = new URL(req.url);

  // Archivos de la app: primero internet (para tener lo último), si tarda o no hay, lo guardado.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, no) => setTimeout(() => no(new Error('lento')), 3500))
        ]);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) ||
               (req.mode === 'navigate' ? await cache.match('index.html') : Response.error());
      }
    })());
    return;
  }

  // Letra (Google Fonts) y la librería de Excel: se guardan la primera vez que se usan.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }));
  }
});
