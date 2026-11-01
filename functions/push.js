// يرسل إشعارات الجوال لمستخدمي النظام (Web Push)
// يقرأ اشتراكات المستلمين من Firestore بصلاحية المُرسِل نفسه، فلا يستطيع استخدامه إلا مستخدم مضاف في النظام
const webpush = require('web-push');
const core = require('./lib/remind-core');
const PROJECT = process.env.FB_PROJECT || 'manhal-49df0';
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const auth = event.headers.authorization || event.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return { statusCode: 401, body: 'no token' };
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'bad json' }; }
  if (req.action) return actions(req, auth.slice(7));
  const to = [...new Set((req.to || []).map(String))].slice(0, 300);
  if (!to.length) return { statusCode: 400, body: 'no recipients' };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://manhalfleet.netlify.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
  const payload = JSON.stringify({ title: String(req.title || 'نظام الأسطول').slice(0, 80), body: String(req.body || '').slice(0, 180), url: String(req.url || './'), tag: req.tag ? String(req.tag).slice(0, 60) : undefined });
  const subs = [];
  for (let i = 0; i < to.length; i += 30) {
    const chunk = to.slice(i, i + 30);
    const r = await fetch(`${FS}:runQuery`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'pushsubs' }], where: { fieldFilter: { field: { fieldPath: 'key' }, op: 'IN', value: { arrayValue: { values: chunk.map(k => ({ stringValue: k })) } } } } } }) });
    if (r.status === 401 || r.status === 403) return { statusCode: 403, body: 'not allowed' };
    if (!r.ok) return { statusCode: 502, body: 'firestore ' + r.status };
    for (const row of await r.json()) if (row.document) subs.push(row.document);
  }
  let sent = 0, gone = 0;
  await Promise.all(subs.map(async d => {
    try { await webpush.sendNotification(JSON.parse(d.fields.sub.stringValue), payload, { TTL: 86400, urgency: 'high' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { gone++; try { await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: { Authorization: auth } }); } catch (x) {} } }
  }));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent, gone, devices: subs.length }) };
};

// إعداد حساب التذكيرات، وإرسال تذكير تجريبي للمستخدم نفسه
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
function emailOf(tok) { try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).email.toLowerCase(); } catch (e) { return ''; } }
async function actions(req, tok) {
  try {
    // التحقق من أن المستدعي مستخدم في النظام: قراءة الإعدادات بصلاحيته
    const chk = await fetch(`${FS}/settings?pageSize=1`, { headers: { Authorization: 'Bearer ' + tok } });
    if (!chk.ok) return J(403, { error: 'not allowed' });
    if (req.action === 'sys-setup') { const s = await core.systemLogin(true); return J(200, { email: s.email, uid: s.uid }); }
    if (req.action === 'hr-send') {
      const me = emailOf(tok);
      let admin = me && me === String(process.env.OWNER_EMAIL || '').toLowerCase();
      if (!admin) { const r = await fetch(`${FS}/access/${encodeURIComponent(me)}`, { headers: { Authorization: 'Bearer ' + tok } }); if (r.ok) { const j = await r.json(); admin = j.fields && j.fields.role && j.fields.role.stringValue === 'admin'; } }
      if (!admin) return J(403, { error: 'admin only' });
      return J(200, await require('./lib/hr-core').send(tok, { to: req.to, cc: req.cc }));
    }
    if (req.action === 'remind-test') {
      const kinds = ['digest', 'friday', 'sign', 'saturday'].filter(k => (req.kinds || ['digest']).includes(k));
      const out = await core.run({ token: tok, kinds, onlyKey: emailOf(tok) });
      return J(200, out.res);
    }
    return J(400, { error: 'unknown action' });
  } catch (e) { return J(500, { error: e.message }); }
}
