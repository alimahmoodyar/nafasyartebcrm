/* Online-only business operations. Cache ONLY the public offline document. */
const CACHE = 'hamnafas-public-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const response = await fetch(OFFLINE, {cache: 'reload', credentials: 'same-origin'});
  // A hosting sign-in redirect is not an offline document.
  if (!response.ok || response.redirected || !(await response.clone().text()).includes('hamnafas-public-offline')) throw new Error('Offline page unavailable');
  await (await caches.open(CACHE)).put(OFFLINE, response);
  await self.skipWaiting();
 })());
});
self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('hamnafas-public-offline-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 // Never intercept APIs, auth, MCP, file downloads or mutations.
 if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname !== '/') return;
 event.respondWith(fetch(event.request).catch(async () =>
  (await (await caches.open(CACHE)).match(OFFLINE)) || new Response('اتصال اینترنت برقرار نیست. دوباره تلاش کنید.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})
 ));
});
