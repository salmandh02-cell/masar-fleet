// أدوات المنصة: قراءة وكتابة Firestore بصلاحية الحساب الآلي، والبريد، وإشعارات فريق المنصة
const webpush = require('web-push');
const { systemLogin } = require('./remind-core');
const ROOT = () => `${process.env.FIRESTORE_EMULATOR_HOST ? 'http://' + process.env.FIRESTORE_EMULATOR_HOST : 'https://firestore.googleapis.com'}/v1/projects/${process.env.FB_PROJECT}/databases/(default)/documents`;
const IDT = `${process.env.FIREBASE_AUTH_EMULATOR_HOST ? 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '/' : 'https://'}identitytoolkit.googleapis.com/v1/accounts`;
const SUPER = () => String(process.env.SUPER_EMAIL || 'salmandh02@gmail.com').toLowerCase();
const APP = () => process.env.APP_NAME || 'نظام أسطول الشركات';
const SITE = () => process.env.SITE_URL || process.env.URL || '';

// ---------- تحويل قيم Firestore ----------
function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return obj(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
}
const obj = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  return { stringValue: String(v) };
}
const H = tok => ({ Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' });
async function get(tok, path) {
  const r = await fetch(`${ROOT()}/${path}`, { headers: H(tok) });
  if (r.status === 404) return null; if (!r.ok) throw new Error(`get ${path} ${r.status}`);
  const d = await r.json(); return { id: d.name.split('/').pop(), ...obj(d.fields) };
}
async function list(tok, path) {
  const out = []; let page = '';
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${ROOT()}/${path}?pageSize=300${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, { headers: H(tok) });
    if (!r.ok) throw new Error(`list ${path} ${r.status}`);
    const j = await r.json(); for (const d of j.documents || []) out.push({ id: d.name.split('/').pop(), ...obj(d.fields) });
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  return out;
}
async function patch(tok, path, data) {
  const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(`${ROOT()}/${path}?${mask}&currentDocument.exists=true`, { method: 'PATCH', headers: H(tok), body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }) });
  if (!r.ok) throw new Error(`patch ${path} ${r.status} ${await r.text()}`);
}
async function create(tok, col, data) {
  const r = await fetch(`${ROOT()}/${col}`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }) });
  if (!r.ok) throw new Error(`create ${col} ${r.status}`);
}

// هوية المستدعي من رمز الدخول (تتحقق منه Google)
async function whoIs(idToken) {
  const r = await fetch(`${IDT}:lookup?key=${process.env.FB_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
  if (!r.ok) return null; const u = ((await r.json()).users || [])[0];
  return u ? { email: String(u.email || '').toLowerCase(), verified: !!u.emailVerified } : null;
}
async function sys() { return (await systemLogin(true)).token; }

// ---------- البريد ----------
let tx = null;
async function mail(to, subject, html) {
  to = [...new Set([].concat(to).filter(Boolean).map(x => String(x).toLowerCase()).filter(x => !x.endsWith('@m.manhalfleet.app')))];
  if (!to.length) return { skipped: 'no recipients' };
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { skipped: 'smtp' };
  if (!tx) { const nodemailer = require('nodemailer'); const port = +(process.env.SMTP_PORT || 465);
    tx = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); }
  const body = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#15201B;max-width:560px">
    <div style="background:#0E5A44;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:bold">${esc(APP())}</div>
    <div style="border:1px solid #D6DDD9;border-top:0;padding:18px;border-radius:0 0 10px 10px">${html}</div></div>`;
  try { await tx.sendMail({ from: `"${APP()}" <${process.env.SMTP_USER}>`, to: to.join(','), subject, html: body }); return { sent: to.length }; }
  catch (e) { console.error('mail', e.message); return { error: e.message }; }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const btn = (href, label) => `<p><a href="${esc(href)}" style="display:inline-block;background:#0E5A44;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">${esc(label)}</a></p>`;

// ---------- إشعارات الجوال ----------
function vapid() { webpush.setVapidDetails(process.env.VAPID_SUBJECT || process.env.URL, process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE); }
async function pushSubs(tok, subs, msg) {
  if (!subs.length) return 0; vapid();
  const payload = JSON.stringify({ title: String(msg.title).slice(0, 80), body: String(msg.body || '').slice(0, 180), url: msg.url || './', tag: msg.tag });
  let sent = 0;
  await Promise.all(subs.map(async d => {
    try { await webpush.sendNotification(JSON.parse(d.sub), payload, { TTL: 86400, urgency: 'high' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { try { await fetch(`${ROOT()}/${d._path}`, { method: 'DELETE', headers: H(tok) }); } catch (x) {} } }
  }));
  return sent;
}
// فريق المنصة: من يملك الدور المطلوب (والمالك دائماً)
async function staffWith(tok, roles) {
  // قبل تسجيل الحساب الآلي في الفريق (أول دخول للمالك) يصل الإشعار للمالك بالبريد فقط
  let st = []; try { st = await list(tok, 'staff'); } catch (e) { console.warn('staff', e.message); }
  return [SUPER(), ...st.filter(s => s.active && roles.includes(s.role)).map(s => s.id)];
}
async function notifyStaff(tok, roles, msg, mailSubject, mailHtml) {
  const emails = await staffWith(tok, roles);
  const subs = (await list(tok, 'platpush').catch(() => [])).filter(s => emails.includes(String(s.key).toLowerCase())).map(s => ({ ...s, _path: 'platpush/' + s.id }));
  const pushed = await pushSubs(tok, subs, msg);
  const mailed = mailSubject ? await mail(emails, mailSubject, mailHtml) : null;
  return { pushed, mailed };
}
async function notifyCompanyUser(tok, cid, email, msg) {
  try {
    const subs = (await list(tok, `companies/${cid}/pushsubs`)).filter(s => String(s.key).toLowerCase() === String(email).toLowerCase()).map(s => ({ ...s, _path: `companies/${cid}/pushsubs/` + s.id }));
    return await pushSubs(tok, subs, msg);
  } catch (e) { return 0; }
}
module.exports = { get, list, patch, create, whoIs, sys, mail, esc, btn, notifyStaff, notifyCompanyUser, SUPER, APP, SITE };
