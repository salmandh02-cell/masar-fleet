// فيديو شرح نظام مسار: جولة مسجّلة بالمتصفح مع عناوين ونصوص على الشاشة
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const SITE = '/tmp/claude-0/e2e/site', FBDIR = '/tmp/claude-0/emu/node_modules/firebase', OUT = '/tmp/claude-0/e2e/video';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(SITE, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8002);
const B = 'http://127.0.0.1:8002/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ar', viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
await ctx.route('**/*', route => { const u = route.request().url(); if (u.startsWith('https://www.gstatic.com/firebasejs/')) return route.fulfill({ path: path.join(FBDIR, u.split('/').pop()), contentType: 'text/javascript' }); if (u.startsWith('https://fonts.')) return route.continue(); if (u.startsWith(B) || u.includes('127.0.0.1:9099') || u.includes('127.0.0.1:8080') || u.startsWith('blob:') || u.startsWith('data:')) return route.continue(); return route.abort(); });
const p = await ctx.newPage(); const T0 = Date.now();
const W = ms => p.waitForTimeout(ms);
await p.goto(B + '?login=1'); await p.waitForSelector('#ae'); await p.fill('#ae', 'demo@m.manhalfleet.app'); await p.fill('#ap', 'TestDemo123'); await p.click('#ab');
await p.waitForFunction(() => window.__companyId && document.getElementById('auth').hidden, null, { timeout: 30000 }); await W(3500);
// إخفاء الشروحات لصورة أنظف
const off = await p.$('[data-act=tips-off]'); if (off) { await off.click(); await W(400); }
// طبقة العرض: بطاقة عنوان، شريط نص، مؤشر فأرة
const overlay = async () => p.evaluate(() => {
  if (document.getElementById('vx-css')) return;
  const st = document.createElement('style'); st.id = 'vx-css'; st.textContent = `
  #vx-card{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:radial-gradient(900px 500px at 75% 0%,rgba(201,162,79,.22),transparent 60%),linear-gradient(150deg,#0F3F33,#08251E 70%);color:#F5EEDC;font-family:Alexandria,sans-serif;text-align:center;transition:opacity .8s}
  #vx-card .in{display:grid;justify-items:center;gap:22px}
  #vx-card img{width:150px;background:#FBF9F4;border-radius:26px;padding:18px 22px;box-shadow:0 0 0 2px rgba(201,162,79,.6),0 18px 40px rgba(0,0,0,.4)}
  #vx-card h1{margin:0;font-weight:600;font-size:46px}#vx-card p{margin:0;font-size:21px;color:#E4C680}
  #vx-cap{position:fixed;left:50%;bottom:34px;transform:translate(-50%,20px);z-index:2147483500;max-width:880px;direction:rtl;background:rgba(8,37,30,.92);color:#fff;border:1px solid rgba(201,162,79,.6);border-radius:16px;padding:14px 26px;font:500 21px/1.6 Alexandria,sans-serif;text-align:center;box-shadow:0 18px 40px -12px rgba(0,0,0,.5);opacity:0;transition:opacity .45s,transform .45s}
  #vx-cap.on{opacity:1;transform:translate(-50%,0)}#vx-cap b{color:#E4C680;font-weight:600}
  #vx-cur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(201,162,79,.35);border:2px solid #C9A24F;pointer-events:none;transition:transform .15s;left:-50px;top:-50px}
  #vx-cur.dn{transform:scale(.7);background:rgba(201,162,79,.7)}`;
  document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'vx-cap'; document.body.appendChild(cap);
  const cur = document.createElement('div'); cur.id = 'vx-cur'; document.body.appendChild(cur);
  addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => cur.classList.add('dn'), true); addEventListener('mouseup', () => cur.classList.remove('dn'), true);
});
const card = (h, s) => p.evaluate(([h, s]) => { let c = document.getElementById('vx-card'); if (!c) { c = document.createElement('div'); c.id = 'vx-card'; document.body.appendChild(c); } c.style.opacity = 1; c.innerHTML = `<div class="in"><img src="masar-logo.png"><h1>${h}</h1><p>${s}</p></div>`; }, [h, s]);
const uncard = () => p.evaluate(() => { const c = document.getElementById('vx-card'); if (c) { c.style.opacity = 0; setTimeout(() => c.remove(), 900); } });
const cap = (t) => p.evaluate(t => { const c = document.getElementById('vx-cap'); c.classList.remove('on'); setTimeout(() => { c.innerHTML = t; if (t) c.classList.add('on'); }, t ? 250 : 0); }, t);
const move = async (sel, click = true) => { const el = await p.waitForSelector(sel, { timeout: 15000 }); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 }); await W(250); if (click) { await p.mouse.down(); await W(90); await p.mouse.up(); } };
const nav = async (route, c) => { await move(`#side a[href="#${route}"]`, false); if (c) await cap(c); await move(`#side a[href="#${route}"]`); await W(1500); };
const scroll = async (dy, steps = 30) => { for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, dy / steps); await W(30); } };
const close = async () => { const c = await p.$('#modal-root [data-act=close]'); if (c) await move('#modal-root [data-act=close]'); else await p.keyboard.press('Escape'); await W(700); };

await p.goto(B + '#dashboard'); await W(2500); await overlay();
const START = Date.now() - T0;
await card('مسار لإدارة الأساطيل', 'جولة في النظام خلال دقيقتين'); await W(4200); await uncard(); await W(900);
// الرئيسية
await p.mouse.move(900, 300); await cap('<b>الرئيسية:</b> حالة الأسطول كله في نظرة واحدة'); await W(3200);
await move('.stat4 button', false); await cap('عدد السيارات المتاحة ومع السائقين وفي الورشة وخارج الخدمة'); await W(3500);
await scroll(420); await cap('<b>يحتاج قرارك:</b> التنبيهات مرتبة حسب الأولوية، الأحمر عاجل'); await W(3800);
await scroll(-420, 15);
// ملف السيارة
await nav('vehicles', '<b>السيارات:</b> بطاقة لكل سيارة باللوحة السعودية وحالة وثائقها'); await W(3500);
await move('.vcard', false); await cap('ملف السيارة: الوثائق والصور والصيانة والحوادث والسجل الكامل'); await move('.vcard'); await W(4200);
await scroll(350, 20); await W(1500); await close();
// التسليم
await nav('handovers', '<b>التسليم والاستلام:</b> سجل العهد، من استلم أي سيارة ومتى'); await W(3200);
await move('main [data-act=ho-out]', false); await cap('محضر تسليم بالعداد والوقود والصور، يوقّعه السائق إلكترونياً من جواله'); await move('main [data-act=ho-out]'); await W(4500); await close();
// الفحص
await nav('inspect', '<b>الفحص الأسبوعي:</b> السائق يفحص سيارته ويصوّر كل بند'); await W(3200);
await move('[data-act=insp-cfg]'); await W(900); await cap('موعد الفحص تحدده الشركة: يوم ثابت، أو لكل سيارة، أو مرن'); await W(2200);
await move('input[name=ic-mode][value=perVehicle]'); await W(1600); await move('input[name=ic-mode][value=flexible]'); await W(1600); await close();
// الصيانة والوقود والمخالفات
await nav('maintenance', '<b>الصيانة:</b> سجل الإصلاحات وتكلفتها وتنبيه موعد الزيت'); await W(3300);
await nav('fuel', '<b>الوقود:</b> استهلاك كل سيارة مقارنة بمتوسط الأسطول لكشف الهدر'); await W(3500);
await nav('violations', '<b>المخالفات:</b> كل مخالفة تُربط بالسائق الذي كان يقود السيارة وقتها'); await W(3500);
// التقارير
await nav('reports', '<b>التقارير:</b> التكلفة بالريال لكل سيارة وكل فرع، بصيغة PDF أو Excel'); await W(3000);
await scroll(380, 25); await W(2500); await scroll(-380, 10);
// الجوال
await cap(''); await W(300);
await p.setViewportSize({ width: 1280, height: 720 });
await card('على الجوال أيضاً', 'المدير يتابع، والسائق يفحص ويوقّع من جواله بالعربية أو الإنجليزية أو الأردية'); await W(4200);
await card('مسار', 'سجّل شركتك وابدأ التجربة المجانية'); await W(4200);
const END = Date.now() - T0;
await ctx.close(); await browser.close(); srv.close();
const vid = fs.readdirSync(OUT).find(f => f.endsWith('.webm'));
fs.writeFileSync(OUT + '/cut.json', JSON.stringify({ file: OUT + '/' + vid, start: START / 1000, end: END / 1000 }));
console.log('done', START, END, vid);
