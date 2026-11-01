import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const SITE = '/home/claude/e2e/site', FBDIR = '/home/claude/emu/node_modules/firebase';
const AUTH = 'http://127.0.0.1:9099', PRJ = 'demo-fleet';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(SITE, p);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8000);
const B = 'http://127.0.0.1:8000/';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
const browser = await chromium.launch();
async function newPage() {
  const ctx = await browser.newContext({ locale: 'ar' }); const page = await ctx.newPage();
  await page.route('**/*', route => { const u = route.request().url();
    if (u.startsWith('https://www.gstatic.com/firebasejs/')) return route.fulfill({ path: path.join(FBDIR, u.split('/').pop()), contentType: 'text/javascript' });
    if (u.startsWith(B) || u.startsWith('http://127.0.0.1:9099') || u.startsWith('http://127.0.0.1:8080')) return route.continue();
    return route.abort(); });
  page.on('pageerror', e => console.log('    [pageerror]', e.message)); page.on('dialog', d => d.accept());
  return page;
}
async function verifyAll() { const j = await (await fetch(`${AUTH}/emulator/v1/projects/${PRJ}/oobCodes`)).json(); for (const c of j.oobCodes || []) if (c.requestType === 'VERIFY_EMAIL') await fetch(c.oobLink); }

console.log('١) تسجيل شركة جديدة');
const p = await newPage();
await p.goto(B); await p.waitForSelector('#a-co', { timeout: 20000 });
await p.click('#a-co');
await p.fill('#cn', 'شركة النخبة للنقل'); await p.fill('#cu', 'أحمد'); await p.fill('#ce', 'ahmed@nukhba.sa'); await p.fill('#cph', '0551234567'); await p.fill('#cp', 'secret123');
await p.click('#cb'); await p.waitForSelector('#vb', { timeout: 15000 }); ok(true, 'شاشة تأكيد البريد ظهرت');
await verifyAll(); await p.click('#vb');
await p.waitForSelector('#kn', { timeout: 15000 });
ok(await p.inputValue('#kn') === 'شركة النخبة للنقل', 'نموذج الشركة معبأ مسبقاً بالاسم');
await p.click('#kb');
await p.waitForFunction(() => window.__companyId && document.getElementById('auth').hidden, null, { timeout: 20000 });
const cid = await p.evaluate(() => window.__companyId); ok(/^c[a-z0-9]{10}$/.test(cid), 'أُنشئت الشركة: ' + cid);
await p.waitForTimeout(2500);
ok((await p.textContent('.brand small')).includes('النخبة'), 'اسم الشركة يظهر أعلى النظام');
const role = await p.evaluate(() => typeof myRole === 'function' ? myRole() : null); ok(role === 'admin', 'دور المستخدم المؤسس: ' + role);
// إضافة سيارة عبر طبقة البيانات
await p.evaluate(async () => { const db = await window.claude.use('db'); await db.collection('vehicles').doc('v1').set({ plateLetters: 'أ ب ج', plateNumbers: '1234', status: 'available' }); });
const vpath = await (await fetch(`http://127.0.0.1:8080/v1/projects/${PRJ}/databases/(default)/documents/companies/${cid}/vehicles/v1`, { headers: { Authorization: 'Bearer owner' } })).json();
ok(vpath.fields && vpath.fields.plateNumbers.stringValue === '1234', 'السيارة حُفظت تحت companies/' + cid + '/vehicles');
const rootV = await fetch(`http://127.0.0.1:8080/v1/projects/${PRJ}/databases/(default)/documents/vehicles/v1`, { headers: { Authorization: 'Bearer owner' } });
ok(rootV.status === 404, 'لا شيء يُكتب في المجموعات العامة القديمة');

console.log('٢) لوحة تحكم المالك');
let r = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'salmandh02@gmail.com', password: 'superpass1', returnSecureToken: true }) })).json();
await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ localId: r.localId, emailVerified: true }) });
const s = await newPage();
await s.goto(B + 'admin.html'); await s.waitForSelector('#le', { state: 'visible', timeout: 20000 });
await s.fill('#le', 'salmandh02@gmail.com'); await s.fill('#lp', 'superpass1'); await s.click('#lf button');
await s.waitForSelector('#rows tr td b', { timeout: 15000 });
ok((await s.textContent('#rows')).includes('شركة النخبة للنقل'), 'الشركة ظاهرة في قائمة المالك');
await s.waitForFunction(() => !document.querySelector('#rows').textContent.includes('…'), null, { timeout: 10000 });
ok((await s.textContent('#kpis')).includes('1'), 'المؤشرات: ' + (await s.textContent('#kpis')).replace(/\s+/g, ' '));
await s.click(`[data-a="suspend"][data-id="${cid}"]`); await s.waitForTimeout(1200);
ok((await s.textContent('#rows')).includes('موقوفة'), 'إيقاف الشركة من اللوحة');

console.log('٣) أثر الإيقاف على الشركة');
await p.reload(); await p.waitForSelector('#su-r', { timeout: 20000 }); ok(true, 'مستخدم الشركة يرى رسالة «الاشتراك موقوف»');
await s.click(`[data-a="activate"][data-id="${cid}"]`); await s.waitForSelector('dialog[open]'); await s.click('dialog button[value="ok"]'); await s.waitForTimeout(1200);
ok((await s.textContent('#rows')).includes('مفعّلة'), 'إعادة التفعيل باشتراك مدفوع');
await p.click('#su-r'); await p.waitForFunction(() => window.__companyId && document.getElementById('auth').hidden, null, { timeout: 20000 }); ok(true, 'بعد التفعيل يدخل المستخدم نظامه');

console.log('٤) المالك العام عند دخول النظام الرئيسي');
const s2 = await newPage(); await s2.goto(B); await s2.waitForSelector('#ae', { timeout: 20000 });
await s2.fill('#ae', 'salmandh02@gmail.com'); await s2.fill('#ap', 'superpass1'); await s2.click('#ab');
await s2.waitForSelector('a[href="admin.html"]', { timeout: 15000 }); ok(true, 'يظهر له زر لوحة تحكم المالك');
await p.screenshot({ path: '/home/claude/e2e/app.png' }); await s.screenshot({ path: '/home/claude/e2e/admin.png', fullPage: true });
console.log(`\n${pass} نجح، ${fail} فشل`);
await browser.close(); srv.close(); process.exit(fail ? 1 : 0);
