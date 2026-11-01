// منطق التذكيرات التلقائية: يقرأ بيانات الأسطول من Firestore ويرسل إشعارات الجوال
const webpush = require('web-push');
const PROJECT = process.env.FB_PROJECT || 'manhal-49df0';
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const IDT = 'https://identitytoolkit.googleapis.com/v1/accounts';
const OWNER = String(process.env.OWNER_EMAIL || '').toLowerCase();

// ---------- Firestore REST ----------
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
const obj = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));
async function list(token, col) {
  const out = []; let page = '';
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${FS}/${col}?pageSize=300${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error(`read ${col} ${r.status}`);
    const j = await r.json();
    for (const d of j.documents || []) out.push({ id: d.name.split('/').pop(), ...obj(d.fields || {}) });
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  return out;
}

// ---------- حساب النظام ----------
async function idt(path, body) {
  const r = await fetch(`${IDT}:${path}?key=${process.env.FB_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, returnSecureToken: true }) });
  return { ok: r.ok, j: await r.json() };
}
async function systemLogin(create) {
  const email = process.env.SYS_EMAIL, password = process.env.SYS_PASS;
  if (!email || !password || !process.env.FB_API_KEY) throw new Error('system account env missing');
  let r = await idt('signInWithPassword', { email, password });
  if (!r.ok && create) r = await idt('signUp', { email, password });
  if (!r.ok) throw new Error('system login: ' + (r.j.error && r.j.error.message));
  return { token: r.j.idToken, uid: r.j.localId, email };
}

// ---------- وقت الرياض ----------
const ksa = (d = new Date()) => new Date(d.getTime() + 3 * 3600e3); // نستخدم دوال UTC على هذا التاريخ
const ymd = d => d.toISOString().slice(0, 10);
function weekStart(now) { const t = new Date(now); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 2) % 7)); return ymd(t); }
const daysUntil = (s, today) => s ? Math.round((new Date(s + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 864e5) : null;
const plateTxt = v => v ? `${v.plateLetters || ''} ${v.plateNumbers || ''}`.trim() : '—';
const ivKey = x => String(x && (x.loginEmail || x.email) || '').toLowerCase();

// ---------- الإرسال ----------
async function sendTo(token, keys, msg) {
  keys = [...new Set(keys.filter(Boolean))]; if (!keys.length) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://manhalfleet.netlify.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
  const subs = [];
  for (let i = 0; i < keys.length; i += 30) {
    const r = await fetch(`${FS}:runQuery`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'pushsubs' }], where: { fieldFilter: { field: { fieldPath: 'key' }, op: 'IN', value: { arrayValue: { values: keys.slice(i, i + 30).map(k => ({ stringValue: k })) } } } } } }) });
    if (!r.ok) throw new Error('pushsubs ' + r.status);
    for (const row of await r.json()) if (row.document) subs.push(row.document);
  }
  const payload = JSON.stringify({ title: msg.title.slice(0, 80), body: msg.body.slice(0, 180), url: msg.url || './', tag: msg.tag });
  let sent = 0;
  await Promise.all(subs.map(async d => {
    try { await webpush.sendNotification(JSON.parse(d.fields.sub.stringValue), payload, { TTL: 6 * 3600, urgency: 'normal' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { try { await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); } catch (x) {} } }
  }));
  return sent;
}

// ---------- التذكيرات ----------
const DOCS = [['istimaraExp', 'الاستمارة'], ['insuranceExp', 'التأمين'], ['fahasExp', 'الفحص الدوري'], ['opCardExp', 'بطاقة التشغيل']];

async function load(token) {
  const [vehicles, drivers, handovers, inspections, maintenance, invites, settings] = await Promise.all(
    ['vehicles', 'drivers', 'handovers', 'inspections', 'maintenance', 'invites', 'settings'].map(c => list(token, c)));
  const cfg = Object.assign({ enabled: false, friday: true, sign: true, digest: true, saturday: true }, settings.find(s => s.id === 'reminders') || {});
  const driverKey = {}; const mgmt = new Set(OWNER ? [OWNER] : []);
  for (const iv of invites) {
    const k = ivKey(iv); if (!k) continue;
    if (iv.role === 'driver' && iv.driverId) (driverKey[iv.driverId] = driverKey[iv.driverId] || []).push(k);
    if (iv.role === 'admin' || iv.role === 'fleet') mgmt.add(k);
  }
  return { vehicles, drivers, handovers, inspections, maintenance, cfg, driverKey, mgmt: [...mgmt] };
}

function digest(D, today) {
  const lines = []; let crit = 0;
  const live = D.vehicles.filter(v => v.status !== 'out' && v.status !== 'sold');
  let exp = 0, soon = 0;
  for (const v of live) for (const [f] of DOCS) { if (f === 'opCardExp' && !v.hasOpCard) continue; const d = daysUntil(v[f], today); if (d === null) continue; if (d < 0) exp++; else if (d <= 30) soon++; }
  if (exp) { lines.push(`${exp} وثيقة منتهية`); crit += exp; }
  if (soon) lines.push(`${soon} وثيقة تنتهي خلال 30 يوم`);
  const oil = live.filter(v => (Math.max(0, (+v.odometer || 0) - (+v.lastOilKm || 0))) >= (+v.oilEveryKm || 5000)).length;
  if (oil) { lines.push(`${oil} سيارة تجاوزت موعد الزيت`); crit += oil; }
  const shop = D.maintenance.filter(m => m.status === 'open' && -daysUntil(String(m.date).slice(0, 10), today) >= 7).length;
  if (shop) lines.push(`${shop} سيارة في الورشة أكثر من أسبوع`);
  const lic = D.drivers.filter(d => d.active !== false && daysUntil(d.licenseExp, today) !== null && daysUntil(d.licenseExp, today) < 0).length;
  if (lic) { lines.push(`${lic} رخصة سائق منتهية`); crit += lic; }
  const uns = D.handovers.filter(h => !h.ack && String(h.at || '').slice(0, 10) >= ymd(new Date(Date.parse(today) - 14 * 864e5))).length;
  if (uns) lines.push(`${uns} محضر بانتظار توقيع مستخدم المركبة`);
  return { lines, crit };
}

function uninspected(D, ws) {
  return D.vehicles.filter(v => v.status !== 'out' && v.status !== 'sold' && v.status !== 'maintenance').filter(v => !D.inspections.some(x => x.vehicleId === v.id && String(x.date) >= ws));
}

// kind: digest | friday | sign | saturday ، أو auto حسب الساعة واليوم
async function run({ token, kinds, onlyKey }) {
  const D = await load(token);
  const now = ksa(); const today = ymd(now); const ws = weekStart(now);
  const res = {};
  const mg = onlyKey ? [onlyKey] : D.mgmt;

  if (kinds.includes('digest')) {
    const g = digest(D, today);
    res.digest = await sendTo(token, mg, g.lines.length
      ? { title: `${g.crit ? '🔴' : '🟡'} ملخص الأسطول اليوم`, body: g.lines.join(' · '), url: './#dashboard', tag: 'digest' }
      : { title: '✅ ملخص الأسطول اليوم', body: 'لا توجد تنبيهات تحتاج متابعة اليوم.', url: './#dashboard', tag: 'digest' });
  }
  if (kinds.includes('friday')) {
    const miss = uninspected(D, ws).filter(v => v.status === 'assigned' && v.driverId);
    const keys = []; for (const v of miss) keys.push(...(D.driverKey[v.driverId] || []));
    res.friday = await sendTo(token, onlyKey ? (keys.length ? [onlyKey] : []) : keys, { title: '🔧 موعد الفحص الأسبوعي', body: 'اليوم الجمعة: افحص سيارتك وصوّر البنود من صفحة الفحص في النظام.', url: './#driver', tag: 'friday' });
  }
  if (kinds.includes('sign')) {
    const since = ymd(new Date(Date.parse(today) - 14 * 864e5));
    const pend = D.handovers.filter(h => !h.ack && h.driverId && String(h.at || '').slice(0, 10) >= since);
    const byKey = {}; for (const h of pend) for (const k of D.driverKey[h.driverId] || []) byKey[k] = (byKey[k] || 0) + 1;
    let s = 0;
    for (const [k, c] of Object.entries(byKey)) { if (onlyKey && k !== onlyKey) continue; s += await sendTo(token, [k], { title: '✍️ محضر بانتظار توقيعك', body: c === 1 ? 'لديك محضر تسليم/استلام لم توقّعه بعد. راجعه ووقّع من صفحتك.' : `لديك ${c} محاضر لم توقّعها بعد. راجعها ووقّع من صفحتك.`, url: './#driver', tag: 'sign' }); }
    res.sign = s;
  }
  if (kinds.includes('saturday')) {
    const miss = uninspected(D, ws);
    if (miss.length || onlyKey) res.saturday = await sendTo(token, mg, miss.length
      ? { title: `🚗 ${miss.length} سيارة لم يُعمل لها الفحص الأسبوعي`, body: miss.slice(0, 8).map(plateTxt).join('، ') + (miss.length > 8 ? '…' : ''), url: './#inspect', tag: 'saturday' }
      : { title: '✅ الفحص الأسبوعي مكتمل', body: 'جميع السيارات العاملة فُحصت هذا الأسبوع.', url: './#inspect', tag: 'saturday' });
  }
  return { cfg: D.cfg, res };
}

// يحدد التذكير المناسب حسب ساعة الرياض واليوم (تعمل الدالة 7 و8 و9 صباحاً)
function dueKinds(cfg, d = ksa()) {
  const h = d.getUTCHours(), wd = d.getUTCDay(); const k = [];
  if (!cfg.enabled) return k;
  if (h === 7 && wd >= 0 && wd <= 4 && cfg.digest) k.push('digest');
  if (h === 8 && wd === 5 && cfg.friday) k.push('friday');
  if (h === 9 && cfg.sign) k.push('sign');
  if (h === 9 && wd === 6 && cfg.saturday) k.push('saturday');
  return k;
}

module.exports = { systemLogin, run, dueKinds, list, load };
