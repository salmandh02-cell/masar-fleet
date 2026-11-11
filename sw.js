// يخدم الصور والمرفقات المحفوظة في قاعدة البيانات عبر روابط _blob/<id>
const VERSION = 'fleet-sw-3';
let TOKEN = null, PROJECT = null, CID = null; const waiters = [];
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'token') { TOKEN = e.data.token; PROJECT = e.data.project; CID = e.data.cid; while (waiters.length) waiters.shift()(); }
});
async function getToken() {
  if (TOKEN && CID) return;
  const cs = await self.clients.matchAll(); cs.forEach(c => c.postMessage({ type: 'need-token' }));
  await new Promise(r => { waiters.push(r); setTimeout(r, 8000); });
}
async function fsGet(id) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/companies/${encodeURIComponent(CID)}/blobs/${encodeURIComponent(id)}`;
  let r = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (r.status === 401) { TOKEN = null; await getToken(); r = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } }); }
  if (!r.ok) throw new Error('blob ' + r.status);
  const f = (await r.json()).fields || {};
  return { type: f.type?.stringValue, chunks: +(f.chunks?.integerValue || 1), data: f.data?.stringValue || '' };
}
function b64ToBytes(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
async function serveBlob(req, id) {
  const cache = await caches.open(VERSION);
  await getToken();
  const key = req.url + (req.url.includes('?') ? '&' : '?') + 'c=' + encodeURIComponent(CID);
  const hit = await cache.match(key); if (hit) return hit;
  const head = await fsGet(id); let b64 = head.data;
  for (let i = 1; i < head.chunks; i++) b64 += (await fsGet(`${id}__${i}`)).data;
  const res = new Response(b64ToBytes(b64), { headers: { 'Content-Type': head.type || 'application/octet-stream', 'Cache-Control': 'max-age=31536000' } });
  cache.put(key, res.clone()); return res;
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const m = u.origin === self.location.origin && u.pathname.match(/\/_blob\/([A-Za-z0-9_-]+)$/);
  if (m) e.respondWith(serveBlob(e.request, m[1]).catch(() => new Response('', { status: 404 })));
});

// إشعارات الجوال
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'مسار', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', dir: 'rtl', lang: 'ar', tag: d.tag, renotify: !!d.tag, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if (c.url.startsWith(self.registration.scope)) { await c.focus(); try { await c.navigate(url); } catch (x) { c.postMessage({ type: 'goto', url }); } return; } }
    await self.clients.openWindow(url);
  })());
});
