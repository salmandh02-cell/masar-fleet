// اختبار النسخ الاحتياطي مع محاكاة Google (لا اتصال فعلي)
const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.GCP_SA_JSON = Buffer.from(JSON.stringify({ client_email: 'b@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' })).toString('base64');
process.env.BACKUP_BUCKET = 'gs://fleet-backups'; process.env.FB_PROJECT = 'fleet-sa-f0678';
const calls = []; let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
global.fetch = async (u, o = {}) => { calls.push({ u, m: o.method || 'GET', b: o.body });
  const R = (j, s = 200) => ({ ok: s < 300, status: s, json: async () => j });
  if (u.includes('oauth2')) { const a = new URLSearchParams(o.body).get('assertion').split('.'); const v = crypto.createVerify('RSA-SHA256').update(a[0] + '.' + a[1]).verify(publicKey, Buffer.from(a[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64')); return v ? R({ access_token: 'tok' }) : R({}, 401); }
  if (u.endsWith(':exportDocuments')) return R({ name: 'projects/fleet-sa-f0678/databases/(default)/operations/abc' });
  if (u.includes('/o?')) return R({ items: [{ name: '2020-01-01_x/all.overall_export_metadata' }, { name: '2099-01-01_y/a' }] });
  return R({});
};
const B = require('../functions/lib/backup-core');
(async () => {
  const r = await B.runBackup('test');
  ok(r.ok && r.path.startsWith('gs://fleet-backups/' + B.riyadhDay()), 'بدأ التصدير إلى الحاوية بمسار اليوم');
  ok(calls.some(c => c.u.includes('oauth2')), 'توقيع JWT صحيح وقبول الدخول');
  ok(r.removed === 1 && calls.some(c => c.m === 'DELETE' && c.u.includes('2020-01-01')) && !calls.some(c => c.m === 'DELETE' && c.u.includes('2099')), 'حذف النسخ القديمة فقط');
  ok(calls.some(c => c.m === 'PATCH' && c.u.includes('platform/backup')), 'تسجيل حالة النسخة');
  delete process.env.GCP_SA_JSON; const r2 = await B.runBackup('test'); ok(!r2.ok && r2.error === 'not-configured', 'بدون إعداد: لا شيء يحدث');
  console.log(`\n${pass} نجح، ${fail} فشل`); process.exit(fail ? 1 : 0);
})();
