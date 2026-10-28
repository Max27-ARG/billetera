// Billetera Digital — guarda la app en el celular para que abra sin internet.
// Si cambiás algún archivo, subí el número de versión para que todos reciban la nueva.
const VERSION = 'billetera-v7';
const ARCHIVOS = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // 'reload': baja los archivos de internet, no de una copia vieja guardada por el navegador
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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

  // Archivos de la app: primero internet, SIEMPRE la versión más nueva (sin copias viejas del navegador).
  // Si no hay internet o tarda mucho, se usa lo guardado en el celular (por ejemplo, en Bermejo).
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const red = fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; });
      try {
        return await Promise.race([red, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 6000))]);
      } catch (err) {
        e.waitUntil(red.catch(() => {})); // si llega tarde, igual se guarda para la próxima
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
