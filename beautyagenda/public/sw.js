/*
 * BeautyAgenda — Service Worker
 * - Permite instalar como aplicativo (PWA).
 * - Guarda em cache apenas arquivos estáticos (JS, CSS, ícones, fontes).
 * - NÃO guarda dados do Supabase: disponibilidade e agendamentos são sempre
 *   consultados online (não há agendamento offline, de propósito).
 */
const VERSION = 'beautyagenda-v1';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0c0d;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:20px}p{color:#a1a1aa}button{margin-top:16px;background:#b8913a;color:#0c0c0d;border:0;border-radius:12px;padding:12px 20px;font-weight:600;font-size:15px}</style></head>
<body><div><h1>Sem conexão com a internet</h1><p>Para ver horários disponíveis e agendar, é preciso estar online.</p>
<button onclick="location.reload()">Tentar novamente</button></div></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(['/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegação: sempre rede; sem internet, mostra aviso
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isStatic = sameOrigin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg');
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  // Qualquer outra coisa (Supabase, APIs) passa direto pela rede, sem cache
  if (!isStatic && !isFont) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }),
  );
});
