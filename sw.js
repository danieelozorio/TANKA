// Eldrin — service worker: deixa o jogo instalável no celular (app) e abre mais rápido.
// Só guarda arquivos do próprio site (imagens, músicas, js, css). O servidor (Supabase) nunca é guardado.
// Páginas, js e css: busca a versão nova primeiro (cai para a guardada se estiver sem internet).
// Imagens e músicas: usa a guardada primeiro (não mudam de nome).
var CACHE = 'eldrin-v1';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  var midia = /\.(webp|png|jpg|jpeg|mp3|mp4|webm|svg)$/i.test(url.pathname);
  if (midia) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (r) {
        return r || fetch(req).then(function (resp) { if (resp.ok && resp.status === 200) c.put(req, resp.clone()); return resp; });
      });
    }));
    return;
  }
  e.respondWith(fetch(req).then(function (resp) {
    if (resp.ok) { var copia = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
    return resp;
  }).catch(function () { return caches.match(req); }));
});
