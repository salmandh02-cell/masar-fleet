// النسخ الاحتياطي: تصدير قاعدة البيانات كاملة يومياً إلى Google Cloud Storage بأداة Firestore الرسمية
// يحتاج حساب خدمة (Service Account) بصلاحيتي: Cloud Datastore Import Export Admin و Storage Admin على الحاوية
// المتغيرات: GCP_SA_JSON (ملف المفتاح نصاً أو base64)، BACKUP_BUCKET (اسم الحاوية دون gs://)، BACKUP_KEEP_DAYS (افتراضي 30)
const crypto = require('crypto');
const FS = () => `https://firestore.googleapis.com/v1/projects/${process.env.FB_PROJECT}/databases/(default)`;
const GCS = 'https://storage.googleapis.com/storage/v1';

function sa() {
  const raw = String(process.env.GCP_SA_JSON || '').trim(); if (!raw) return null;
  try { return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); } catch (e) { throw new Error('GCP_SA_JSON غير صالح'); }
}
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function saToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write', aud: key.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(key.private_key);
  const r = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${body}.${b64u(sig)}` });
  if (!r.ok) throw new Error('تعذر الدخول بحساب الخدمة ' + r.status);
  return (await r.json()).access_token;
}
const H = t => ({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
const riyadhDay = (d = new Date()) => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10);

async function status(tok, data) {
  const f = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v ?? '') }]));
  const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&');
  await fetch(`${FS()}/documents/platform/backup?${mask}`, { method: 'PATCH', headers: H(tok), body: JSON.stringify({ fields: f }) }).catch(() => {});
}

// يبدأ التصدير (تكمله Google في الخلفية خلال دقائق) ويحذف النسخ الأقدم من مدة الاحتفاظ
async function runBackup(by = 'schedule') {
  const key = sa(); const bucket = String(process.env.BACKUP_BUCKET || '').replace(/^gs:\/\//, '').replace(/\/.*$/, '');
  if (!key || !bucket) return { ok: false, error: 'not-configured' };
  const tok = await saToken(key); const day = riyadhDay(); const prefix = `${day}_${Date.now().toString(36)}`;
  const r = await fetch(`${FS()}:exportDocuments`, { method: 'POST', headers: H(tok), body: JSON.stringify({ outputUriPrefix: `gs://${bucket}/${prefix}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const error = (j.error && j.error.message) || ('export ' + r.status); await status(tok, { lastTry: new Date().toISOString(), ok: false, error, by }); return { ok: false, error }; }
  const removed = await prune(tok, bucket).catch(e => { console.warn('prune', e.message); return -1; });
  await status(tok, { lastAt: new Date().toISOString(), lastTry: new Date().toISOString(), op: j.name || '', path: `gs://${bucket}/${prefix}`, ok: true, error: '', by, removed: String(removed) });
  return { ok: true, op: j.name, path: `gs://${bucket}/${prefix}`, removed };
}
async function prune(tok, bucket) {
  const keep = Math.max(3, +process.env.BACKUP_KEEP_DAYS || 30); const cut = riyadhDay(new Date(Date.now() - keep * 864e5));
  let page = '', n = 0;
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`${GCS}/b/${bucket}/o?fields=items(name),nextPageToken&maxResults=1000${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, { headers: H(tok) });
    if (!r.ok) throw new Error('list ' + r.status); const j = await r.json();
    for (const o of j.items || []) { const d = String(o.name).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cut) { await fetch(`${GCS}/b/${bucket}/o/${encodeURIComponent(o.name)}`, { method: 'DELETE', headers: H(tok) }); n++; } }
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  return n;
}
// حالة عملية تصدير جارية
async function opStatus(name) {
  const key = sa(); if (!key || !/^projects\/[\w-]+\/databases\/\(default\)\/operations\/[\w-]+$/.test(String(name))) return { ok: false };
  const tok = await saToken(key); const r = await fetch(`https://firestore.googleapis.com/v1/${name}`, { headers: H(tok) }); const j = await r.json().catch(() => ({}));
  return { ok: r.ok, done: !!j.done, state: j.metadata && j.metadata.operationState, error: j.error && j.error.message, progress: j.metadata && j.metadata.progressDocuments };
}
module.exports = { runBackup, opStatus, saToken, sa, riyadhDay };
