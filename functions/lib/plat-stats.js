// إحصاءات نشاط الشركات لمالك المنصة: آخر دخول، المستخدمون النشطون، عدد السيارات، وتجاوز حد الباقة
// تُحسب بالحساب الآلي وتُحفظ في platstats/{cid}، فلا تحتاج لوحة المنصة لقراءة بيانات الشركات
const P = require('./plat-core');
const ROOT = () => `${process.env.FIRESTORE_EMULATOR_HOST ? 'http://' + process.env.FIRESTORE_EMULATOR_HOST : 'https://firestore.googleapis.com'}/v1/projects/${process.env.FB_PROJECT}/databases/(default)/documents`;

async function count(tok, parent, col) {
  const r = await fetch(`${ROOT()}/${parent}:runAggregationQuery`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: col }] }, aggregations: [{ alias: 'n', count: {} }] } }) });
  if (!r.ok) throw new Error(`count ${col} ${r.status}`);
  const j = await r.json(); const f = (j[0] && j[0].result && j[0].result.aggregateFields) || {};
  return +((f.n && f.n.integerValue) || 0);
}

async function run(tok) {
  const now = Date.now(); const wk = new Date(now - 7 * 864e5).toISOString(); const at = new Date().toISOString();
  const out = { companies: 0, over: [] };
  for (const c of await P.list(tok, 'companies')) {
    if (['pending', 'rejected'].includes(c.status)) continue;
    const s = { cid: c.id, at };
    try { s.vehicles = await count(tok, `companies/${c.id}`, 'vehicles'); } catch (e) { s.vehicles = null; }
    try { const seen = await P.list(tok, `companies/${c.id}/seen`); const ts = seen.map(x => String(x.at || '')).filter(Boolean).sort();
      s.users = seen.length; s.active7 = ts.filter(t => t >= wk).length; s.lastSeen = ts[ts.length - 1] || ''; } catch (e) { s.users = null; }
    s.over = !!(+c.maxVehicles && s.vehicles != null && s.vehicles > +c.maxVehicles);
    if (s.over) out.over.push(c.id);
    await P.upsert(tok, `platstats/${c.id}`, s); out.companies++;
  }
  return out;
}

// حالة الإعدادات السرية: نعرض هل هي موجودة فقط، دون أي قيمة
function config() {
  const e = process.env; const has = k => !!(e[k] && String(e[k]).trim());
  return {
    firebase: has('FB_API_KEY') && has('FB_PROJECT'), system: has('SYS_EMAIL') && has('SYS_PASS'), site: e.SITE_URL || e.URL || '',
    push: has('VAPID_PUBLIC') && has('VAPID_PRIVATE'), mail: has('SMTP_USER') && has('SMTP_PASS'), mailUser: has('SMTP_USER') ? String(e.SMTP_USER).replace(/^(.).*(@.*)$/, '$1***$2') : '',
    payments: has('MOYASAR_SECRET'), ai: has('ANTHROPIC_API_KEY'), aiModel: e.AI_MODEL || 'claude-haiku-5-5',
    backup: has('GCP_SA_JSON') && has('BACKUP_BUCKET'), deploy: (e.DEPLOY_ID || e.COMMIT_REF || '').slice(0, 12), node: process.version
  };
}
module.exports = { run, count, config };
