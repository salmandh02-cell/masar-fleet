// طبقة الربط بين النظام و Firebase (الدخول، قاعدة البيانات، الصور، التنزيل، سجل التدقيق)
import { FIREBASE_CONFIG, SUPER_ADMIN_EMAIL, APP_NAME, TRIAL_DAYS, SUPPORT_CONTACT } from './config.js';
const V = '10.12.2';
const FB = `https://www.gstatic.com/firebasejs/${V}`;

const readyResolve = () => (window.__appReadyResolve || (() => {}))();

/* ---------- service worker: يخدم الصور المحفوظة في قاعدة البيانات ---------- */
async function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      // أول زيارة: نعيد التحميل مرة واحدة حتى يتحكم الـ SW بالصفحة
      if (!sessionStorage.getItem('sw-reloaded')) { sessionStorage.setItem('sw-reloaded', '1'); location.reload(); return new Promise(() => {}); }
    }
    return reg;
  } catch (e) { console.warn('SW', e); }
}
function swPost(msg) { try { navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage(msg); } catch (e) {} }

/* ---------- واجهة الدخول ---------- */
const AUTH_CSS = `
#auth{position:fixed;inset:0;z-index:50;overflow:auto;background:var(--surface,#fff);color:var(--ink,#16302A);font-family:var(--f-body,"IBM Plex Sans Arabic",sans-serif)}
#auth[hidden]{display:none}
#auth .aw{min-height:100%;display:grid;grid-template-columns:minmax(0,1fr) min(560px,100%)}
#auth .aside{background:#173B33;color:#E9E2D2;padding:56px 64px;display:flex;flex-direction:column;position:relative;overflow:hidden}
#auth .amk{display:flex;gap:14px;align-items:center}#auth .amk i{width:52px;height:52px;border-radius:14px;background:#EDE6D6;color:#173B33;display:grid;place-items:center;font:600 22px var(--f-display,"Alexandria",sans-serif);font-style:normal;overflow:hidden}#auth .amk i img{width:100%;height:100%;object-fit:contain;background:#fff;padding:4px;box-sizing:border-box}
#auth .amk b{display:block;font:500 19px var(--f-display,"Alexandria",sans-serif);color:#fff}#auth .amk small{color:#AFC3BA;font-size:14px}
#auth .ah{margin:auto 0 16px;font:500 40px/1.5 var(--f-display,"Alexandria",sans-serif);color:#fff;max-width:560px}
#auth .ap{margin:0;color:#B9CCC3;font-size:17px;line-height:1.8;max-width:520px}#auth .aside hr{border:0;width:64px;height:2px;background:#A88653;margin:28px 0 0}
#auth .card{background:var(--surface,#fff);padding:48px 60px;display:flex;flex-direction:column;gap:14px;min-height:100vh;box-sizing:border-box}
#auth .card>.lang-pick{justify-content:flex-start}
#auth .card .body{margin:auto 0;display:grid;gap:14px;width:100%;max-width:440px}
#auth .lg{display:none;align-items:center;gap:12px}#auth .lg i{width:42px;height:42px;border-radius:12px;background:#173B33;color:#EDE6D6;display:grid;place-items:center;font:600 19px var(--f-display,"Alexandria",sans-serif);font-style:normal;overflow:hidden}#auth .lg i img{width:100%;height:100%;object-fit:contain;background:#fff;padding:3px;box-sizing:border-box}
#auth .lg b{font:500 17px var(--f-display,"Alexandria",sans-serif)}#auth .lg small{display:block;color:var(--muted,#6F7B75);font-size:13px}
#auth h2{margin:0;font:500 30px var(--f-display,"Alexandria",sans-serif)}
#auth .sub2{margin:-6px 0 10px;color:var(--muted,#6F7B75);font-size:15px;line-height:1.7}
#auth label{display:grid;gap:7px;font-size:14px;font-weight:500;color:var(--ink,#16302A);position:relative}
#auth input{font:inherit;font-size:16px;height:52px;padding:0 16px;border:1px solid #D3D9D4;border-radius:12px;background:var(--surface,#fff);color:inherit;box-sizing:border-box;width:100%}
#auth input:focus{outline:0;border-color:#173B33;box-shadow:0 0 0 3px #DCE6E1}
#auth .kind{position:absolute;left:14px;bottom:15px;font-size:12.5px;color:var(--muted,#6F7B75);font-weight:400;pointer-events:none}
#auth button.pri{font:500 16px var(--f-body,"IBM Plex Sans Arabic",sans-serif);height:54px;border:0;border-radius:12px;background:#173B33;color:#fff;cursor:pointer}
#auth button.pri:disabled{opacity:.6}
#auth .lnk{background:none;border:0;color:#173B33;font:inherit;font-size:14px;font-weight:600;cursor:pointer;padding:2px}
#auth .row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
#auth .err{color:#B42318;font-size:14px;min-height:1em}
#auth .ok{color:#0E5A44;font-size:14px}
#auth p{margin:0;line-height:1.7;font-size:14px}
.lang-pick{display:flex;justify-content:flex-end}
.lang-pick .lang-tg{width:40px;height:40px;min-height:40px;padding:0;border-radius:50%;display:grid;place-items:center;font:600 13px "IBM Plex Sans Arabic",system-ui,sans-serif;letter-spacing:.04em;direction:ltr;border:1.5px solid var(--acc,#0E5A44);background:transparent;color:var(--acc,#0E5A44);cursor:pointer;transition:background .2s,color .2s}
.lang-pick .lang-tg:hover{background:var(--acc,#0E5A44);color:#fff}
#auth.land{display:block;place-items:normal;overflow-y:auto;padding:0;background:#F5F3EE;color:#15201B;scroll-behavior:smooth}
#auth.land .lp-w{max-width:1180px;margin:0 auto;padding:0 20px}
#auth.land .lp-top{position:sticky;top:0;z-index:5;background:#0B3F30;color:#fff;border-bottom:1px solid rgba(255,255,255,.08)}
#auth.land .lp-top .lp-w{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}
#auth.land .lp-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;min-width:0}
#auth.land .lp-brand b{font:700 18px var(--f-display,"Readex Pro",sans-serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#auth.land .lp-brand .mk{border-color:#C9A227;color:#C9A227}
#auth .mk:has(img){background:#fff;border:0;padding:3px;width:40px;height:40px;border-radius:11px;display:inline-grid;place-items:center;flex:none}#auth .mk img{width:100%;height:100%;object-fit:contain;display:block}
#auth.land .lp-brand .nm{display:grid;line-height:1.15;min-width:0}#auth.land .lp-brand .nm small{font-size:11.5px;opacity:.75;font-weight:400}
#auth.land .lp-top nav{display:flex;align-items:center;gap:16px}
#auth.land .lp-top nav>a{color:rgba(255,255,255,.8);text-decoration:none;font-size:15px}
#auth.land .lp-top nav>a:hover{color:#fff}
#auth.land .lp-top .lang-pick .lang-tg{border-color:rgba(255,255,255,.45);color:#fff;width:36px;height:36px;min-height:36px}
#auth.land .lp-top .lang-pick .lang-tg:hover{background:rgba(255,255,255,.18)}
#auth.land .lp-btn{font:600 15px var(--f-body,"IBM Plex Sans Arabic",sans-serif);padding:9px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.45);background:transparent;color:#fff;cursor:pointer;white-space:nowrap}
#auth.land .lp-btn.gold{background:#C9A227;border-color:#C9A227;color:#1b1405}
#auth.land .lp-hero{position:relative;color:#fff;padding:64px 0 72px;min-height:620px;background:linear-gradient(270deg,rgba(6,42,32,.94) 0%,rgba(6,42,32,.82) 42%,rgba(6,42,32,.45) 100%),#0B3F30 url(hero-fleet.svg) center/cover no-repeat}
#auth.land[dir=ltr] .lp-hero{background:linear-gradient(90deg,rgba(6,42,32,.94) 0%,rgba(6,42,32,.82) 42%,rgba(6,42,32,.45) 100%),#0B3F30 url(hero-fleet.svg) center/cover no-repeat}
#auth.land .lp-hgrid{display:grid;grid-template-columns:1fr 420px;gap:56px;align-items:center}
#auth.land .lp-kick{display:inline-block;font-size:14px;color:#C9A227;border:1px solid rgba(201,162,39,.5);border-radius:20px;padding:4px 14px;margin-bottom:18px}
#auth.land .lp-copy h1{font:700 clamp(30px,4.2vw,50px)/1.3 var(--f-display,"Readex Pro",sans-serif);margin:0 0 16px}
#auth.land .lp-copy p{font-size:18px;line-height:1.8;color:rgba(255,255,255,.88);max-width:560px;margin:0 0 26px}
#auth.land .lp-chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
#auth.land .lp-chips li{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px);border-radius:12px;padding:8px 14px;font-size:15px}
#auth.land .lp-chips svg{color:#C9A227;width:20px;height:20px}
#auth.land #auth-slot .card{width:100%;color:#15201B}
#auth.land #auth-slot .card{min-height:0;border-radius:22px;padding:40px 44px;position:relative;overflow:hidden;box-shadow:0 30px 70px -30px rgba(0,0,0,.6),0 0 0 1px rgba(201,162,79,.35)}
#auth.land #auth-slot .card::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#94722F,#E2C27A,#94722F)}
#auth button.pri{background:linear-gradient(135deg,#145244,#0E3B30 55%,#08251E)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 8px 20px -10px rgba(8,37,30,.7)}
#auth.land .lp-top{background:linear-gradient(115deg,#08251E,#0E3B30 55%,#145244)!important;box-shadow:0 1px 0 rgba(201,162,79,.5)}
@media (max-width:860px){#auth.land #auth-slot .card{padding:28px 22px;border-radius:18px}}
#auth.land .lp-mpick{display:none}
#auth.land .lp-sec{padding:76px 0}#auth.land .lp-sec.alt{background:#fff}
#auth.land .lp-t{font:700 32px var(--f-display,"Readex Pro",sans-serif);text-align:center;margin:0 0 8px}
#auth.land .lp-st{text-align:center;color:#5A6862;margin:0 auto 40px;max-width:620px;font-size:17px}
#auth.land .lp-ba{display:grid;grid-template-columns:1fr 1fr;gap:20px}
#auth.land .lp-col{border-radius:18px;padding:28px;background:#fff;border:1px solid #E2DED3}
#auth.land .lp-col.aft{background:#0B3F30;color:#fff;border-color:#0B3F30}
#auth.land .lp-col h3{margin:0 0 16px;font:700 22px var(--f-display,"Readex Pro",sans-serif)}
#auth.land .lp-col.bef h3{color:#B42318}#auth.land .lp-col.aft h3{color:#C9A227}
#auth.land .lp-col ul{list-style:none;margin:0;padding:0;display:grid;gap:14px}
#auth.land .lp-col li{display:flex;gap:12px;align-items:flex-start;font-size:16px;line-height:1.7}
#auth.land .lp-col li svg{flex:none;width:22px;height:22px;margin-top:3px;border-radius:50%;padding:3px}
#auth.land .lp-col.bef li svg{background:#FDE7E5;color:#B42318}#auth.land .lp-col.aft li svg{background:rgba(61,214,140,.18);color:#3DD68C}
#auth.land .lp-feats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
#auth.land .lp-feat{border:1px solid #E2DED3;border-radius:16px;padding:22px;background:#F9F8F4}
#auth.land .lp-feat i{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#E3EFE9;color:#0E5A44}
#auth.land .lp-feat h3{margin:14px 0 6px;font:600 18px var(--f-display,"Readex Pro",sans-serif)}
#auth.land .lp-feat p{margin:0;color:#5A6862;font-size:15px}
#auth.land .lp-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;counter-reset:s}
#auth.land .lp-steps li{background:#fff;border:1px solid #E2DED3;border-radius:16px;padding:22px;display:grid;gap:4px}
#auth.land .lp-steps li::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#0E5A44;color:#fff;font-weight:700;margin-bottom:8px}
#auth.land .lp-steps b{font:600 18px var(--f-display,"Readex Pro",sans-serif)}#auth.land .lp-steps span{color:#5A6862;font-size:15px}
#auth.land .lp-cta{background:#0B3F30 url(hero-fleet.svg) center/cover;border-radius:22px;padding:48px 24px;text-align:center;color:#fff;box-shadow:inset 0 0 0 2000px rgba(6,42,32,.82)}
#auth.land .lp-cta h2{margin:0 0 8px;font:700 30px var(--f-display,"Readex Pro",sans-serif)}#auth.land .lp-cta p{font-size:17px;margin:0 0 22px;color:rgba(255,255,255,.88)}
#auth.land .lp-foot{border-top:1px solid #E2DED3;padding:26px 0;color:#5A6862;font-size:14px}
#auth.land .lp-foot .lp-w{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}#auth.land .lp-foot a{color:#5A6862}#auth.land .lp-foot .lp-w>span:last-child{display:flex;gap:8px 18px;flex-wrap:wrap}
@media (max-width:980px){#auth.land .lp-feats{grid-template-columns:1fr 1fr}#auth.land .lp-steps{grid-template-columns:1fr 1fr}#auth.land .lp-hide{display:none}}
@media (max-width:860px){#auth.land .lp-hgrid{grid-template-columns:1fr;gap:24px}#auth.land .lp-hero{min-height:0;padding:32px 0 40px;background:linear-gradient(rgba(6,42,32,.86),rgba(6,42,32,.86)),#0B3F30 url(hero-fleet.svg) 60% center/cover no-repeat}
  #auth.land .lp-copy p{font-size:16px;margin-bottom:0}#auth.land .lp-chips{display:none}#auth.land .lp-kick{margin-bottom:12px}
  #auth.land .lp-ba{grid-template-columns:1fr}#auth.land .lp-sec{padding:52px 0}#auth.land .lp-t{font-size:26px}}
@media (max-width:560px){#auth.land .lp-feats,#auth.land .lp-steps{grid-template-columns:1fr}#auth.land .lp-top .lp-w{min-height:56px}#auth.land .lp-brand b{font-size:15px}
  #auth.land .lp-top nav{gap:8px}#auth.land .lp-btn{padding:7px 12px;font-size:14px}#auth.land .lp-btn.gold{display:none}#auth.land .lp-cta .lp-btn.gold{display:inline-block}
#auth .foot{margin-top:auto;padding-top:22px;border-top:1px solid var(--line,#E1E5E0);color:var(--muted,#6F7B75);font-size:14px;line-height:1.7}
  #auth.land .lp-copy h1{font-size:26px}}`;
const ERR = {
  'auth/invalid-credential': 'الإيميل أو كلمة المرور غير صحيحة', 'auth/wrong-password': 'كلمة المرور غير صحيحة', 'auth/user-not-found': 'لا يوجد حساب بهذا الإيميل',
  'auth/invalid-email': 'الإيميل غير صحيح', 'auth/email-already-in-use': 'يوجد حساب بهذا الإيميل – سجّل الدخول', 'auth/weak-password': 'كلمة المرور قصيرة (6 أحرف على الأقل)',
  'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً ثم حاول', 'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت'
};
export const PHONE_DOMAIN = 'm.manhalfleet.app';
const AR = '٠١٢٣٤٥٦٧٨٩';
export function normPhone(v) { let d = String(v || '').replace(/[٠-٩]/g, c => AR.indexOf(c)).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('966')) d = '0' + d.slice(3); if (d.length === 9 && d[0] === '5') d = '0' + d; return d; }
export const phoneEmail = (phone, code) => `966${normPhone(phone).slice(1)}.${code}@${PHONE_DOMAIN}`;
const isPhoneAcct = e => String(e || '').toLowerCase().endsWith('@' + PHONE_DOMAIN);
const phoneOf = e => { const m = String(e || '').match(/^966(\d+)\./); return m ? '0' + m[1] : ''; };
window.__phoneEmail = phoneEmail; window.__normPhone = normPhone; window.__phoneOf = phoneOf;
export async function loginKey(kind, v) { const d = new TextEncoder().encode(String(v || '').trim().toLowerCase()); const h = await crypto.subtle.digest('SHA-256', d); return kind + ':' + [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
window.__loginKey = loginKey;
const USER_RE = /^(?=.*[a-z])[a-z0-9._]{3,30}$/;
window.__userRe = USER_RE;
function idKind(v) { v = String(v || '').trim(); if (!v) return ''; if (v.includes('@')) return 'email'; if (/^[+\d\s٠-٩()-]+$/.test(v)) return 'phone'; return 'user'; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function authRoot() {
  let r = document.getElementById('auth');
  if (!r) { const st = document.createElement('style'); st.textContent = AUTH_CSS; document.head.appendChild(st); r = document.createElement('div'); r.id = 'auth'; document.body.appendChild(r); }
  if (!r.dataset.go) { r.dataset.go = '1'; r.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (!g || !AUTH_GO[g.dataset.go]) return; e.preventDefault(); AUTH_GO[g.dataset.go]();
    const sl = document.getElementById('auth-slot'); if (sl) { r.scrollTo({ top: 0, behavior: 'smooth' }); if (innerWidth < 860) setTimeout(() => sl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); } }); }
  r.hidden = false; return r;
}
const T = (s, v) => (window.I18N ? window.I18N.t(s, v) : s);
let lastShow = null;
/* صفحة الدخول: تظهر كصفحة تعريفية كاملة للزائر غير المسجّل، وكبطاقة فقط بعد الدخول */
let AUTH_REF = null, AUTH_GO = {};
const IC = {
  car: '<path d="M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v5h-2.5M5.5 18H3v-5h18"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  sign: '<path d="M4 20h16M6 16l9.5-9.5a2.1 2.1 0 0 1 3 3L9 19H6z"/>',
  cam: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z"/>',
  fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M5 10h9M14 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M10 7v10" stroke-dasharray="2 2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M16 5.5a3 3 0 0 1 0 5.5M18 14c2 .6 3 2.2 3 5"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>', ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
function landingHTML() {
  const ar = !window.I18N || window.I18N.ui === 'ar';
  const name = esc(APP_NAME || T('مسار'));
  const BA = [
    ['السيارات في جداول Excel وأوراق متفرقة، ولكل موظف نسخته الخاصة', 'ملف إلكتروني لكل سيارة بوثائقها وصورها وسجلها الكامل'],
    ['تنتهي الاستمارة أو التأمين أو رخصة السائق دون أن ينتبه أحد', 'تنبيه على الجوال قبل الانتهاء بأيام، مرتّب حسب الأولوية'],
    ['تصل المخالفة ولا يُعرف من كان يقود السيارة يومها', 'كل مخالفة تُربط بسائقها تلقائياً من سجل التسليم والاستلام'],
    ['فواتير الوقود تُدفع دون مقارنتها بالمسافة المقطوعة', 'معدل استهلاك لكل سيارة يكشف الهدر والتلاعب'],
    ['تقرير التكاليف يُجمع يدوياً آخر كل شهر', 'تقرير التكاليف جاهز بنقرة، PDF أو Excel']];
  const OF = [
    ['car', 'ملف لكل سيارة', 'الاستمارة والتأمين والفحص الدوري والصور، وملصق QR يفتح ملفها مباشرة.'],
    ['sign', 'تسليم واستلام بتوقيع إلكتروني', 'محضر بالعداد والصور يوقّعه السائق من جواله، فتُعرف العهدة في كل يوم.'],
    ['cam', 'فحص أسبوعي بالصور', 'السائق يصوّر سيارته كل أسبوع، وتعرف فوراً من تأخر.'],
    ['wrench', 'الصيانة وتغيير الزيت', 'سجل الإصلاحات وتكلفتها، وتنبيه موعد الزيت حسب العداد.'],
    ['fuel', 'الوقود وكشف الهدر', 'استيراد كشوف المحطات من Excel، ومقارنة استهلاك كل سيارة بمتوسط الأسطول.'],
    ['ticket', 'المخالفات والحوادث', 'ربط كل مخالفة بسائقها وقت وقوعها، وكشف خصومات شهري للموارد البشرية.'],
    ['users', 'فروع وصلاحيات', 'مدير نظام، ومشرف يرى فرعه فقط، وسائق يرى سيارته فقط.'],
    ['chart', 'تقارير جاهزة', 'تكلفة كل سيارة وكل فرع بالريال، وملخص للإدارة العليا.'],
    ['spark', 'الذكاء الاصطناعي', 'صوّر الفاتورة أو المخالفة فتُعبّأ الحقول تلقائياً، واسأل المساعد عن بيانات أسطولك.']];
  const top = `<header class="lp-top"><div class="lp-w">
    <a class="lp-brand" href="#" data-go="login"><span class="mk"><img src="masar-mark.png" alt=""></span><span class="nm"><b>${name}</b><small>${T('لإدارة الأساطيل')}</small></span></a>
    <nav>${ar ? `<a class="lp-hide" href="#lp-ba">${T('قبل وبعد')}</a><a class="lp-hide" href="#lp-offer">${T('ماذا نقدم')}</a><a class="lp-hide" href="welcome.html#pricing">${T('الأسعار')}</a>` : ''}
      ${window.I18N ? window.I18N.picker() : ''}
      <button class="lp-btn" data-go="login">${T('تسجيل الدخول')}</button>${ar ? `<button class="lp-btn gold" data-go="co">${T('سجّل شركتك')}</button>` : ''}</nav></div></header>`;
  const hero = `<section class="lp-hero"><div class="lp-w lp-hgrid">
    <div class="lp-copy">${ar ? `<span class="lp-kick">منصة سعودية لإدارة أساطيل الشركات</span>
      <h1>كل سيارة في أسطولك، برقمها وحالتها وتكلفتها</h1>
      <p>اعرف من يقود كل سيارة، ومتى تنتهي وثائقها، وكم تكلّفك، من شاشة واحدة على الجوال أو الكمبيوتر.</p>
      <ul class="lp-chips"><li>${ic('bell')}تنبيهات قبل انتهاء الوثائق</li><li>${ic('sign')}عهدة موقّعة إلكترونياً</li><li>${ic('fuel')}كشف هدر الوقود</li></ul>`
      : `<h1>${name}</h1>`}</div>
    <div id="auth-slot"></div></div></section>`;
  if (!ar) return top + hero;
  return top + hero + `
  <section class="lp-sec" id="lp-ba"><div class="lp-w">
    <h2 class="lp-t">ماذا يتغيّر في شركتك؟</h2><p class="lp-st">نفس الأسطول ونفس الفريق، لكن بمعلومة واضحة في وقتها.</p>
    <div class="lp-ba">
      <div class="lp-col bef"><h3>قبل النظام</h3><ul>${BA.map(x => `<li>${ic('x')}<span>${x[0]}</span></li>`).join('')}</ul></div>
      <div class="lp-col aft"><h3>بعد النظام</h3><ul>${BA.map(x => `<li>${ic('ok')}<span>${x[1]}</span></li>`).join('')}</ul></div>
    </div></div></section>
  <section class="lp-sec alt" id="lp-offer"><div class="lp-w">
    <h2 class="lp-t">ماذا نقدّم لك</h2><p class="lp-st">كل ما يحتاجه مدير الأسطول في نظام واحد، بالعربية، ويعمل دون تثبيت.</p>
    <div class="lp-feats">${OF.map(f => `<div class="lp-feat"><i>${ic(f[0])}</i><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div>
  </div></section>
  <section class="lp-sec"><div class="lp-w">
    <h2 class="lp-t">ابدأ في أربع خطوات</h2><p class="lp-st">بدون أجهزة ولا تركيب.</p>
    <ol class="lp-steps"><li><b>سجّل شركتك</b><span>بيانات المنشأة والسجل التجاري.</span></li><li><b>نعتمد الحساب</b><span>نراجع البيانات ونتواصل معك.</span></li><li><b>أضف سياراتك</b><span>يدوياً أو باستيراد ملف Excel.</span></li><li><b>ادعُ السائقين</b><span>برمز تفعيل على جوالاتهم.</span></li></ol>
  </div></section>
  <section class="lp-sec"><div class="lp-w"><div class="lp-cta">
    <h2>جرّب النظام على أسطولك</h2><p>تجربة مجانية ${TRIAL_DAYS} يوماً بكامل المزايا، بدون بطاقة ائتمانية.</p>
    <div><button class="lp-btn gold" data-go="co">سجّل شركتك الآن</button> <button class="lp-btn" data-go="login">لدي حساب</button></div>
  </div></div></section>
  <footer class="lp-foot"><div class="lp-w"><span>© ${new Date().getFullYear()} ${name}</span>
    <span><a href="welcome.html#pricing">الأسعار</a><a href="privacy.html">سياسة الخصوصية</a><a href="terms.html">شروط الاستخدام</a>${SUPPORT_CONTACT ? `<a href="mailto:${esc(SUPPORT_CONTACT)}" dir="ltr">${esc(SUPPORT_CONTACT)}</a>` : ''}</span></div></footer>`;
}
function card(inner) {
  if (window.I18N) window.I18N.use(window.I18N.lang);
  const r = authRoot();
  const land = !(AUTH_REF && AUTH_REF.currentUser);
  const ui = window.I18N ? window.I18N.ui : 'ar';
  const box = `<div class="card" role="dialog" aria-label="${T('تسجيل الدخول')}">${land ? (window.I18N ? `<div class="lp-mpick">${window.I18N.picker()}</div>` : '') : (window.I18N ? window.I18N.picker() : '') + `<div class="lg"><span class="mk"><img src="masar-mark.png" alt=""></span><div><b>${esc(APP_NAME || T('مسار'))}</b><small>${T('إدارة السيارات والسائقين والتكاليف')}</small></div></div>`}${inner}</div>`;
  if (land) {
    if (r.dataset.mode !== 'land' || r.dataset.lang !== ui) { r.innerHTML = landingHTML(); r.dataset.mode = 'land'; r.dataset.lang = ui; r.classList.add('land'); }
    r.querySelector('#auth-slot').innerHTML = box;
  } else { r.innerHTML = box; r.dataset.mode = 'card'; r.classList.remove('land'); }
  r.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { window.I18N.set(b.dataset.lang); window.I18N.use(b.dataset.lang); if (lastShow) lastShow(); else if (land && AUTH_GO.login) AUTH_GO.login(); });
}

export async function start() {
  if (window.I18N) window.I18N.use(window.I18N.lang);
  const swP = setupSW();
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
  await swP;
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app); AUTH_REF = auth;
  let fs;
  try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { fs = F.getFirestore(app); }
  const SUPER = String(SUPER_ADMIN_EMAIL || '').toLowerCase();
  let CID = null, COMPANY = null;
  const P = c => c === "logins" ? "logins" : `companies/${CID}/${c}`;

  A.onIdTokenChanged(auth, async u => { if (u && CID) swPost({ type: 'token', token: await u.getIdToken(), project: FIREBASE_CONFIG.projectId, cid: CID }); });
  navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data && e.data.type === 'need-token' && auth.currentUser && CID) swPost({ type: 'token', token: await auth.currentUser.getIdToken(), project: FIREBASE_CONFIG.projectId, cid: CID });
  });
  window.__fbIdToken = async () => auth.currentUser ? auth.currentUser.getIdToken() : null;
  window.__changePassword = async (cur, nw) => { const u = auth.currentUser; if (!u) throw new Error('no user'); await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, cur)); await A.updatePassword(u, nw); };
  window.__fbSignOut = async () => { try { (await caches.keys()).forEach(k => caches.delete(k)); } catch (e) {} try { localStorage.removeItem('fleet-brand'); } catch (e) {} await A.signOut(auth); location.reload(); };

  /* ----- شاشات الدخول ----- */
  function showLogin(msg) {
    lastShow = () => showLogin(msg);
    card(`<h2>${T('تسجيل الدخول')}</h2><p class="sub2">${T('ادخل بأي من بياناتك: رقم الجوال أو الإيميل أو اسم المستخدم.')}</p>
      <form id="af" style="display:grid;gap:16px">
      <label>${T('رقم الجوال أو الإيميل أو اسم المستخدم')}<input id="ae" type="text" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required><span class="kind" id="akind"></span></label>
      <label>${T('كلمة المرور')}<input id="ap" type="password" dir="ltr" autocomplete="current-password" required></label>
      <div class="row"><span></span><button type="button" class="lnk" id="a-rst">${T('نسيت كلمة المرور؟')}</button></div>
      <div class="err" id="aerr">${esc(msg || '')}</div>
      <button class="pri" id="ab">${T('دخول')}</button></form>
      <div class="row"><button class="lnk" id="a-new">${T('مستخدم جديد؟ فعّل حسابك')}</button></div>
      <div class="row" style="border-top:1px solid var(--line,#D6DDD9);padding-top:12px"><span style="font-size:14px">${T('شركة جديدة؟')}</span><button class="lnk" id="a-co">${T('سجّل شركتك')}</button></div>`);
    const f = document.getElementById('af'); const kd = document.getElementById('akind');
    const KL = { phone: T('رقم جوال'), email: T('إيميل'), user: T('اسم مستخدم') };
    f.ae.oninput = () => { kd.textContent = KL[idKind(f.ae.value)] || ''; };
    f.onsubmit = async e => { e.preventDefault(); const b = document.getElementById('ab'); b.disabled = true;
      const id = f.ae.value.trim(); const er = document.getElementById('aerr'); er.textContent = '';
      const fail = m => { er.textContent = m; b.disabled = false; };
      try {
        let email = ''; const k = idKind(id);
        if (k === 'phone') {
          const ph = normPhone(id); if (!/^05\d{8}$/.test(ph)) return fail(T('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام'));
          const s = await F.getDoc(F.doc(fs, 'logins', ph));
          if (!s.exists()) return fail(T('هذا الرقم غير مفعّل بعد. افتح رابط الدعوة الذي وصلك من مدير النظام لتفعيل حسابك.'));
          email = s.data().email;
        } else if (k === 'email') {
          let s = null; try { s = await F.getDoc(F.doc(fs, 'logins', await loginKey('e', id))); } catch (x) {}
          email = s && s.exists() ? s.data().email : id;
        } else {
          const u = id.toLowerCase().replace(/^@/, '');
          let s = null; if (USER_RE.test(u)) { try { s = await F.getDoc(F.doc(fs, 'logins', await loginKey('u', u))); } catch (x) {} }
          if (!s || !s.exists()) return fail(T('اسم المستخدم غير موجود. تأكد منه أو ادخل برقم الجوال.'));
          email = s.data().email;
        }
        await A.signInWithEmailAndPassword(auth, email, f.ap.value);
      } catch (err) { fail(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' ? T('بيانات الدخول أو كلمة المرور غير صحيحة') : (window.I18N && window.I18N.ui !== 'ar' ? T('تعذر الدخول، حاول مرة أخرى') : (ERR[err.code] || 'تعذر الدخول، حاول مرة أخرى'))); } };
    setTimeout(() => document.getElementById('ae').focus(), 50);
    document.getElementById('a-new').onclick = () => showActivate();
    document.getElementById('a-co').onclick = () => showCompanySignup();
    document.getElementById('a-rst').onclick = async () => { const v = document.getElementById('ae').value.trim();
      if (idKind(v) === 'email') { let s = null; try { s = await F.getDoc(F.doc(fs, 'logins', await loginKey('e', v))); } catch (x) {} if (!s || !s.exists()) return showReset(v); }
      showForgotPhone(); };
  }
  function showForgotPhone() {
    lastShow = showForgotPhone;
    card(`<h2>${T('نسيت كلمة المرور')}</h2><p>${T('تواصل مع مدير النظام ليرسل لك رمز تفعيل جديد، ثم افتح الرابط الذي يصلك وسجّل كلمة مرور جديدة.')}</p>
      <div class="row"><button class="lnk" id="r-back">${T('رجوع')}</button><button class="lnk" id="r-mail">${T('الدخول بالإيميل؟ استعادة بالبريد')}</button></div>`);
    document.getElementById('r-back').onclick = () => showLogin();
    document.getElementById('r-mail').onclick = () => showReset('');
  }
  let busyAuth = false;
  function showActivate(pre) {
    pre = pre || {};
    lastShow = () => showActivate({ phone: (document.getElementById('se') || {}).value || pre.phone, code: (document.getElementById('sc') || {}).value || pre.code });
    card(`<h2>${T('تفعيل الحساب')}</h2><p>${T('اكتب رقم جوالك ورمز التفعيل الذي أرسله لك مدير النظام، ثم اختر كلمة المرور.')}</p>
      <form id="sf" style="display:grid;gap:12px">
      <label>${T('رقم الجوال')}<input id="se" type="text" inputmode="tel" dir="ltr" placeholder="05xxxxxxxx" value="${esc(pre.phone || '')}" required></label>
      <label>${T('رمز التفعيل (6 أرقام)')}<input id="sc" type="text" inputmode="numeric" dir="ltr" maxlength="6" value="${esc(pre.code || '')}" required></label>
      <label>${T('الاسم')}<input id="sn" type="text" autocomplete="name" required></label>
      <label>${T('كلمة المرور (6 أحرف أو أرقام على الأقل)')}<input id="sp" type="password" dir="ltr" autocomplete="new-password" minlength="6" required></label>
      <div class="err" id="serr"></div><button class="pri" id="sb">${T('تفعيل والدخول')}</button></form>
      <div class="row"><button class="lnk" id="s-back">${T('لدي حساب – تسجيل الدخول')}</button><button class="lnk" id="s-mail">${T('التسجيل بالإيميل')}</button></div>`);
    const f = document.getElementById('sf'); const er = document.getElementById('serr');
    setTimeout(() => document.getElementById(pre.phone ? 'sn' : 'se').focus(), 50);
    f.onsubmit = async e => { e.preventDefault(); const b = document.getElementById('sb'); b.disabled = true; er.className = 'err'; er.textContent = '';
      const ph = normPhone(document.getElementById('se').value); const code = String(document.getElementById('sc').value).replace(/[٠-٩]/g, c => AR.indexOf(c)).replace(/\D/g, '');
      if (!/^05\d{8}$/.test(ph)) { er.textContent = T('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام'); b.disabled = false; return; }
      if (code.length !== 6) { er.textContent = T('رمز التفعيل 6 أرقام'); b.disabled = false; return; }
      const email = phoneEmail(ph, code); let c; busyAuth = true;
      try { c = await A.createUserWithEmailAndPassword(auth, email, document.getElementById('sp').value); }
      catch (err) { er.textContent = err.code === 'auth/email-already-in-use' ? T('هذا الحساب مفعّل مسبقاً – سجّل الدخول برقم الجوال وكلمة المرور') : (window.I18N && window.I18N.ui !== 'ar' ? T('تعذر التفعيل') : (ERR[err.code] || 'تعذر التفعيل')); b.disabled = false; busyAuth = false; return; }
      try {
        const m = await F.getDoc(F.doc(fs, 'members', email)).catch(() => null);
        const cid = m && m.exists() ? m.data().companyId : null;
        const a = cid ? await F.getDoc(F.doc(fs, 'companies', cid, 'access', email)).catch(() => null) : null;
        if (!a || !a.exists()) { try { await c.user.delete(); } catch (x) {} er.textContent = T('رمز التفعيل غير صحيح أو انتهى. اطلب رمزاً جديداً من مدير النظام.'); b.disabled = false; busyAuth = false; return; }
        await A.updateProfile(c.user, { displayName: document.getElementById('sn').value.trim() });
        await F.setDoc(F.doc(fs, 'logins', ph), { email, phone: ph, companyId: cid, at: new Date().toISOString() });
        history.replaceState(null, '', location.pathname + location.hash);
        busyAuth = false; join = null; enter(auth.currentUser);
      } catch (err) { er.textContent = T('تعذر إكمال التفعيل، حاول مرة أخرى'); b.disabled = false; busyAuth = false; }
    };
    document.getElementById('s-back').onclick = () => showLogin();
    document.getElementById('s-mail').onclick = showSignup;
  }
  function showSignup() {
    lastShow = null;
    card(`<h2>إنشاء حساب</h2><p>استخدم نفس الإيميل الذي أضافه مدير النظام لك.</p>
      <form id="sf" style="display:grid;gap:12px">
      <label>الاسم<input id="sn" type="text" autocomplete="name" required></label>
      <label>البريد الإلكتروني<input id="se" type="email" dir="ltr" autocomplete="username" required></label>
      <label>كلمة المرور (6 أحرف على الأقل)<input id="sp" type="password" dir="ltr" autocomplete="new-password" minlength="6" required></label>
      <div class="err" id="serr"></div><button class="pri" id="sb">إنشاء الحساب</button></form>
      <div class="row"><button class="lnk" id="s-back">لدي حساب – تسجيل الدخول</button></div>`);
    const f = document.getElementById('sf');
    f.onsubmit = async e => { e.preventDefault(); const b = document.getElementById('sb'); b.disabled = true;
      try { const c = await A.createUserWithEmailAndPassword(auth, document.getElementById('se').value.trim(), document.getElementById('sp').value);
        await A.updateProfile(c.user, { displayName: document.getElementById('sn').value.trim() });
        await A.sendEmailVerification(c.user); showVerify(c.user); }
      catch (err) { document.getElementById('serr').textContent = ERR[err.code] || 'تعذر إنشاء الحساب'; b.disabled = false; } };
    document.getElementById('s-back').onclick = () => showLogin();
  }
  function showReset(email) {
    lastShow = null;
    card(`<h2>استعادة كلمة المرور</h2><form id="rf" style="display:grid;gap:12px">
      <label>البريد الإلكتروني<input id="re" type="email" dir="ltr" value="${esc(email || '')}" required></label>
      <div class="err" id="rerr"></div><button class="pri">إرسال رابط الاستعادة</button></form>
      <div class="row"><button class="lnk" id="r-back">رجوع</button></div>`);
    document.getElementById('rf').onsubmit = async e => { e.preventDefault();
      try { await A.sendPasswordResetEmail(auth, document.getElementById('re').value.trim()); document.getElementById('rerr').className = 'ok'; document.getElementById('rerr').textContent = 'أرسلنا رابط الاستعادة إلى بريدك. افحص البريد غير المرغوب أيضاً.'; }
      catch (err) { document.getElementById('rerr').textContent = ERR[err.code] || 'تعذر الإرسال'; } };
    document.getElementById('r-back').onclick = () => showLogin();
  }
  function showVerify(u) {
    lastShow = null;
    card(`<h2>تأكيد البريد الإلكتروني</h2><p>أرسلنا رسالة تأكيد إلى <b dir="ltr">${esc(u.email)}</b>. افتح الرسالة واضغط الرابط، ثم ارجع هنا واضغط «تم التأكيد». (افحص البريد غير المرغوب أيضاً)</p>
      <div class="err" id="verr"></div><button class="pri" id="vb">تم التأكيد</button>
      <div class="row"><button class="lnk" id="v-re">إعادة إرسال الرسالة</button><button class="lnk" id="v-out">خروج</button></div>`);
    document.getElementById('vb').onclick = async () => { await u.reload(); if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); enter(auth.currentUser); } else document.getElementById('verr').textContent = 'لم يتم التأكيد بعد'; };
    document.getElementById('v-re').onclick = async () => { try { await A.sendEmailVerification(u); document.getElementById('verr').className = 'ok'; document.getElementById('verr').textContent = 'أُعيد الإرسال'; } catch (e) { document.getElementById('verr').textContent = ERR[e.code] || 'انتظر قليلاً ثم أعد المحاولة'; } };
    document.getElementById('v-out').onclick = window.__fbSignOut;
  }
  function showNoAccess(u) {
    const who = isPhoneAcct(u.email) ? phoneOf(u.email) : u.email;
    lastShow = () => showNoAccess(u);
    card(`<h2>${T('حسابك غير مضاف للنظام')}</h2><p>${T('دخلت بـ {who}، لكن الحساب غير مضاف أو أُعيد تعيينه. اطلب من مدير النظام إضافتك أو إرسال رمز تفعيل جديد، ثم اضغط «إعادة المحاولة».', { who: '<b dir="ltr">' + esc(who) + '</b>' })}</p>
      <button class="pri" id="na">${T('إعادة المحاولة')}</button><div class="row"><button class="lnk" id="n-out">${T('خروج')}</button></div>`);
    document.getElementById('na').onclick = () => enter(u);
    document.getElementById('n-out').onclick = window.__fbSignOut;
  }

  /* ----- دالة المنصة (إشعارات، دفع) ----- */
  async function platCall(body) {
    const t = auth.currentUser && await auth.currentUser.getIdToken();
    const r = await fetch('/.netlify/functions/plat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status); return j;
  }
  const platNotify = body => platCall(body).catch(e => console.warn('notify', e.message));
  /* فواتير الشركة: عرض، دفع إلكتروني، وإرفاق إيصال التحويل */
  async function coInvoices(cid) {
    const s = await F.getDocs(F.query(F.collection(fs, 'invoices'), F.where('cid', '==', cid)));
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.seq || 0) - (a.seq || 0));
  }
  async function attachReceipt(u, cid, inv, file, note) {
    const d = await prepFile(file); const ref = F.doc(F.collection(fs, 'kyc'));
    await F.setDoc(ref, { cid, kind: 'receipt', invoiceId: inv.id, ...d, at: new Date().toISOString(), by: String(u.email).toLowerCase() });
    await F.updateDoc(F.doc(fs, 'invoices', inv.id), { receiptId: ref.id, receiptAt: new Date().toISOString(), receiptNote: String(note || '').slice(0, 300), receiptBy: String(u.email).toLowerCase(), updatedAt: new Date().toISOString() });
    platNotify({ action: 'receipt', invoiceId: inv.id });
  }
  function pickFile() { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf,image/*'; i.onchange = () => res(i.files[0] || null); i.click(); }); }

  /* ----- تسجيل شركة جديدة ----- */
  const PENDING = 'fleet-pending-company';
  const pend = { get() { try { return JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(PENDING, JSON.stringify(v)); } catch (e) {} }, clear() { try { localStorage.removeItem(PENDING); } catch (e) {} } };
  function showCompanySignup() {
    lastShow = null;
    card(`<h2>تسجيل شركة جديدة</h2><p>أنشئ حساب مدير النظام، ثم أكمل بيانات الشركة الرسمية. نراجع الطلب ونتواصل معك، وبعد الاعتماد تبدأ التجربة المجانية ${TRIAL_DAYS} يوماً.</p>
      <form id="cf" style="display:grid;gap:12px">
      <label>اسم الشركة<input id="cn" type="text" maxlength="120" autocomplete="organization" required></label>
      <label>اسمك (مدير النظام)<input id="cu" type="text" autocomplete="name" required></label>
      <label>البريد الإلكتروني<input id="ce" type="email" dir="ltr" autocomplete="username" required></label>
      <label>رقم الجوال<input id="cph" type="text" inputmode="tel" dir="ltr" placeholder="05xxxxxxxx"></label>
      <label>كلمة المرور (6 أحرف على الأقل)<input id="cp" type="password" dir="ltr" autocomplete="new-password" minlength="6" required></label>
      <div class="err" id="cerr"></div><button class="pri" id="cb">إنشاء الحساب</button></form>
      <div class="row"><button class="lnk" id="c-back">لدي حساب – تسجيل الدخول</button></div>`);
    const f = document.getElementById('cf'); const er = document.getElementById('cerr');
    setTimeout(() => { const c = document.getElementById('cn'); if (c) c.focus(); }, 50);
    f.onsubmit = async e => { e.preventDefault(); const b = document.getElementById('cb'); b.disabled = true; er.textContent = '';
      const name = document.getElementById('cn').value.trim(), uname = document.getElementById('cu').value.trim();
      const phone = document.getElementById('cph').value.trim() ? normPhone(document.getElementById('cph').value) : '';
      if (name.length < 2) { er.textContent = 'اكتب اسم الشركة'; b.disabled = false; return; }
      if (phone && !/^05\d{8}$/.test(phone)) { er.textContent = 'رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام'; b.disabled = false; return; }
      busyAuth = true;
      try {
        const c = await A.createUserWithEmailAndPassword(auth, document.getElementById('ce').value.trim(), document.getElementById('cp').value);
        await A.updateProfile(c.user, { displayName: uname });
        pend.set({ name, phone, uname, email: String(c.user.email).toLowerCase() });
        await A.sendEmailVerification(c.user);
        busyAuth = false; showVerify(c.user);
      } catch (err) { busyAuth = false; er.textContent = ERR[err.code] || 'تعذر إنشاء الحساب'; b.disabled = false; }
    };
    document.getElementById('c-back').onclick = () => showLogin();
  }
  const newCid = () => 'c' + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => x.toString(36).padStart(2, '0')).join('').slice(0, 10);
  /* بيانات الشركة الرسمية: تُراجَع من شركة النظام قبل الاعتماد */
  const PF = [
    ['بيانات المنشأة', [
      ['legalName', 'الاسم التجاري حسب السجل', 'text', 1], ['crNumber', 'رقم السجل التجاري', 'num', 1], ['unifiedNumber', 'الرقم الوطني الموحد (700)', 'num'],
      ['vatNumber', 'الرقم الضريبي (15 رقماً)', 'num'], ['activity', 'النشاط', 'text'], ['fleetSize', 'عدد السيارات تقريباً', 'num']]],
    ['العنوان الوطني', [
      ['city', 'المدينة', 'text', 1], ['district', 'الحي', 'text', 1], ['street', 'الشارع', 'text', 1], ['buildingNo', 'رقم المبنى', 'num', 1],
      ['postalCode', 'الرمز البريدي', 'num', 1], ['additionalNo', 'الرقم الإضافي', 'num'], ['shortAddress', 'العنوان المختصر', 'text']]],
    ['التواصل', [
      ['officialEmail', 'البريد الرسمي للشركة', 'email', 1], ['companyPhone', 'هاتف الشركة', 'tel', 1], ['contactName', 'اسم المسؤول', 'text', 1],
      ['contactTitle', 'المسمى الوظيفي', 'text'], ['contactMobile', 'جوال المسؤول', 'tel', 1], ['website', 'الموقع الإلكتروني', 'text']]]];
  const DOCS = [['cr', 'السجل التجاري', 1], ['vat', 'شهادة التسجيل في ضريبة القيمة المضافة'], ['address', 'شهادة العنوان الوطني'], ['other', 'مستند آخر']];
  const FORM_CSS = `#auth{overflow:auto;place-items:start center}#auth .card.wide{width:min(720px,100%);margin:12px 0}
#auth fieldset{border:1px solid var(--line,#D6DDD9);border-radius:12px;padding:12px;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
#auth legend{font-weight:600;padding:0 6px;font-size:14px}#auth .rq{color:#B42318}
#auth input[type=file]{padding:8px;font-size:13px}#auth .fl{font-size:12px;color:var(--muted,#5A6862)}`;
  const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  // الصور تُصغَّر، وملف PDF يُرفع كما هو (حتى 700 كيلوبايت)
  async function prepFile(f) {
    if (/^image\//.test(f.type)) {
      const img = await createImageBitmap(f); const k = Math.min(1, 1800 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = .85, out; do { out = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); q -= .15; } while (out.size > 700e3 && q > .2);
      f = new File([out], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
    if (f.size > 700e3) throw new Error('size');
    return { name: f.name, type: f.type || 'application/octet-stream', size: f.size, data: await toB64(f) };
  }
  async function uploadDocs(u, cid, files) {
    for (const [kind, f] of files) { const d = await prepFile(f);
      await F.setDoc(F.doc(F.collection(fs, 'kyc')), { cid, kind, ...d, at: new Date().toISOString(), by: String(u.email).toLowerCase() }); }
  }
  async function createCompany(u, { name, phone, uname, profile }) {
    const email = String(u.email).toLowerCase(); const now = new Date().toISOString();
    const cid = newCid();
    const b = F.writeBatch(fs);
    b.set(F.doc(fs, 'companies', cid), { name, ownerUid: u.uid, ownerEmail: email, ownerName: uname || u.displayName || '', phone: phone || '', status: 'pending', plan: 'trial', createdAt: now, submittedAt: now, profile });
    b.set(F.doc(fs, 'members', email), { companyId: cid, at: now });
    b.set(F.doc(fs, 'companies', cid, 'access', email), { role: 'admin', name: uname || u.displayName || '', phone: phone || null, driverId: null, branchId: null, inviteId: null, owner: true, updatedAt: now });
    await b.commit();
    pend.clear();
    return cid;
  }
  // نموذج بيانات الشركة: للتسجيل الأول، ولتعديل الطلب قبل اعتماده أو بعد رفضه
  function showCreateCompany(u, pre, existing) {
    pre = pre || {}; const pr = (existing && existing.profile) || pre.profile || {};
    lastShow = null;
    if (!document.getElementById('auth-form-css')) { const st = document.createElement('style'); st.id = 'auth-form-css'; st.textContent = FORM_CSS; document.head.appendChild(st); }
    const inp = ([k, l, t, req]) => `<label><span>${l}${req ? ' <b class="rq">*</b>' : ''}</span><input name="${k}" ${t === 'num' ? 'inputmode="numeric" dir="ltr"' : t === 'tel' ? 'inputmode="tel" dir="ltr" placeholder="05xxxxxxxx"' : t === 'email' ? 'type="email" dir="ltr"' : 'type="text"'} maxlength="120" value="${esc(pr[k] || (k === 'legalName' ? pre.name || '' : k === 'contactName' ? pre.uname || '' : k === 'contactMobile' ? pre.phone || '' : ''))}" ${req ? 'required' : ''}></label>`;
    card(`<h2>${existing ? 'تعديل بيانات الطلب' : 'بيانات شركتك الرسمية'}</h2>
      <p>حسابك <b dir="ltr">${esc(u.email)}</b> جاهز. أكمل بيانات الشركة كما في السجل التجاري، وسيتواصل معك فريقنا للتحقق ثم اعتماد الحساب.</p>
      <form id="kf" style="display:grid;gap:14px">
      <label><span>اسم الشركة (يظهر في النظام) <b class="rq">*</b></span><input id="kn" type="text" maxlength="120" value="${esc(existing ? existing.name : pre.name || '')}" required></label>
      ${PF.map(([t, fs_]) => `<fieldset><legend>${t}</legend>${fs_.map(inp).join('')}</fieldset>`).join('')}
      <fieldset><legend>المستندات (PDF أو صورة، حتى 700 كيلوبايت)</legend>
        ${DOCS.map(([k, l, req]) => `<label><span>${l}${req && !existing ? ' <b class="rq">*</b>' : ''}</span><input type="file" data-kind="${k}" accept="application/pdf,image/*" ${req && !existing ? 'required' : ''}></label>`).join('')}
        ${existing ? '<div class="fl" style="grid-column:1/-1">المستندات التي رفعتها سابقاً محفوظة. أضف مستنداً جديداً عند الحاجة فقط.</div>' : ''}
      </fieldset>
      <div class="err" id="kerr"></div><button class="pri" id="kb">${existing ? 'حفظ وإعادة إرسال الطلب' : 'إرسال طلب التسجيل'}</button></form>
      <div class="row">${existing ? '<button class="lnk" id="k-back">رجوع</button>' : ''}<button class="lnk" id="k-out">خروج</button></div>`);
    document.querySelector('#auth .card').classList.add('wide');
    const f = document.getElementById('kf');
    f.onsubmit = async e => { e.preventDefault(); const b = document.getElementById('kb'); b.disabled = true; const er = document.getElementById('kerr'); er.textContent = '';
      const fail = m => { er.textContent = m; b.disabled = false; };
      const name = document.getElementById('kn').value.trim(); if (name.length < 2) return fail('اكتب اسم الشركة');
      const profile = {}; PF.forEach(([, fl]) => fl.forEach(([k, , t]) => { let v = f.elements[k].value.trim(); if (t === 'num') v = v.replace(/[٠-٩]/g, c => AR.indexOf(c)); if (t === 'tel' && v) v = normPhone(v); profile[k] = v; }));
      if (!/^\d{10}$/.test(profile.crNumber)) return fail('رقم السجل التجاري 10 أرقام');
      if (profile.vatNumber && !/^3\d{13}3$/.test(profile.vatNumber)) return fail('الرقم الضريبي 15 رقماً يبدأ وينتهي بـ 3');
      if (profile.unifiedNumber && !/^7\d{9}$/.test(profile.unifiedNumber)) return fail('الرقم الوطني الموحد 10 أرقام يبدأ بـ 7');
      for (const k of ['companyPhone', 'contactMobile']) if (profile[k] && !/^0\d{8,9}$/.test(profile[k])) return fail('تأكد من أرقام الهاتف والجوال');
      if (!/^\d{5}$/.test(profile.postalCode)) return fail('الرمز البريدي 5 أرقام');
      const files = [...f.querySelectorAll('input[type=file]')].filter(i => i.files[0]).map(i => [i.dataset.kind, i.files[0]]);
      try { for (const [, x] of files) if (!/^image\//.test(x.type) && x.size > 700e3) return fail(`حجم الملف «${x.name}» أكبر من 700 كيلوبايت`); } catch (x) {}
      try {
        let cid;
        if (existing) { cid = existing.id;
          await F.updateDoc(F.doc(fs, 'companies', cid), { name, profile, phone: profile.contactMobile || '', status: 'pending', submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
        else cid = await createCompany(u, { name, phone: profile.contactMobile || pre.phone || '', uname: pre.uname || profile.contactName, profile });
        try { await uploadDocs(u, cid, files); } catch (x) { console.warn(x); alert('سُجّل الطلب، لكن تعذر رفع بعض المستندات. يمكنك رفعها لاحقاً من «تعديل بيانات الطلب».'); }
        platNotify({ action: 'signup', cid });
        entered = false; enter(u);
      } catch (err) { console.warn(err); fail(existing ? 'تعذر الحفظ، حاول مرة أخرى' : 'تعذر إرسال الطلب. قد يكون حسابك مسجلاً في شركة أخرى.'); } };
    const bk = document.getElementById('k-back'); if (bk) bk.onclick = () => { entered = false; enter(u); };
    document.getElementById('k-out').onclick = window.__fbSignOut;
  }
  // الطلب قيد المراجعة أو مرفوض: لا دخول للنظام حتى الاعتماد
  function showPending(u) {
    lastShow = () => showPending(u);
    const rej = COMPANY.status === 'rejected';
    card(`<h2>${rej ? 'لم يُعتمد الطلب' : 'طلبك قيد المراجعة'}</h2>
      <p>${rej ? `راجعنا طلب تسجيل <b>${esc(COMPANY.name)}</b> ولم يُعتمد بعد${COMPANY.rejectReason ? '، والسبب:' : '.'}` : `استلمنا طلب تسجيل <b>${esc(COMPANY.name)}</b>. سيتواصل معك فريقنا للتحقق من البيانات، ثم يُعتمد الحساب وتصلك إمكانية الدخول.`}</p>
      ${rej && COMPANY.rejectReason ? `<p style="background:#FEF3F2;border-radius:10px;padding:10px 12px;color:#B42318">${esc(COMPANY.rejectReason)}</p>` : ''}
      ${rej ? '<p>عدّل البيانات المطلوبة ثم أعد إرسال الطلب.</p>' : ''}
      ${SUPPORT_CONTACT ? `<p>للتواصل: <span dir="ltr">${esc(SUPPORT_CONTACT)}</span></p>` : ''}
      <button class="pri" id="pd-r">${rej ? 'تعديل البيانات وإعادة الإرسال' : 'تحديث الحالة'}</button>
      <div class="row">${rej ? '' : '<button class="lnk" id="pd-e">تعديل بيانات الطلب</button>'}<button class="lnk" id="pd-out">خروج</button></div>`);
    const edit = () => showCreateCompany(u, {}, { id: CID, ...COMPANY });
    document.getElementById('pd-r').onclick = rej ? edit : () => { entered = false; enter(u); };
    const e = document.getElementById('pd-e'); if (e) e.onclick = edit;
    document.getElementById('pd-out').onclick = window.__fbSignOut;
  }
  function showSuspended(u) {
    lastShow = () => showSuspended(u);
    const why = COMPANY && COMPANY.suspendReason ? `(${esc(COMPANY.suspendReason)}) ` : '';
    card(`<h2>الاشتراك موقوف</h2><p>اشتراك شركة <b>${esc(COMPANY && COMPANY.name || '')}</b> موقوف حالياً ${why}والبيانات محفوظة كما هي. ادفع الفاتورة المستحقة أو تواصل معنا لإعادة التفعيل.</p>
      <div id="su-inv" style="display:grid;gap:8px"></div>
      ${SUPPORT_CONTACT ? `<p dir="ltr" style="text-align:right">${esc(SUPPORT_CONTACT)}</p>` : ''}
      <button class="pri" id="su-r">إعادة المحاولة</button><div class="row"><button class="lnk" id="su-out">خروج</button></div>`);
    document.getElementById('su-r').onclick = () => { entered = false; enter(u); };
    document.getElementById('su-out').onclick = window.__fbSignOut;
    const own = String(u.email).toLowerCase() === String(COMPANY && COMPANY.ownerEmail || '').toLowerCase();
    if (!own) return;
    coInvoices(CID).then(list => { const un = list.filter(i => i.status === 'unpaid'); const box = document.getElementById('su-inv'); if (!box || !un.length) return;
      box.innerHTML = un.map(i => `<div style="border:1px solid var(--line,#D6DDD9);border-radius:10px;padding:10px 12px;display:grid;gap:6px"><div><b dir="ltr">${esc(i.number)}</b> · ${esc(i.total)} ريال${i.receiptId ? ' · <span style="color:#0E5A44">أُرفق إيصال، بانتظار المراجعة</span>' : ''}</div>
        <div class="row" style="justify-content:flex-start;gap:12px"><a class="lnk" href="pay.html?inv=${esc(i.id)}">ادفع الآن</a><button class="lnk" data-rc="${esc(i.id)}">إرفاق إيصال تحويل</button></div></div>`).join('');
      box.onclick = async e => { const b = e.target.closest('[data-rc]'); if (!b) return; const f = await pickFile(); if (!f) return;
        try { await attachReceipt(u, CID, un.find(x => x.id === b.dataset.rc), f); b.textContent = 'أُرفق الإيصال ✓'; b.disabled = true; } catch (x) { alert(x.message === 'size' ? 'حجم الملف أكبر من 700 كيلوبايت' : 'تعذر رفع الإيصال'); } };
    }).catch(() => {});
  }
  function showSuperChoice(u, hasCompany) {
    lastShow = null;
    card(`<h2>مرحباً ${esc(u.displayName || '')}</h2><p>أنت من فريق إدارة المنصة. اختر وجهتك:</p>
      <a class="pri" href="admin.html" style="text-align:center;text-decoration:none;display:block;padding:12px;border-radius:10px;background:var(--acc,#0E5A44);color:#fff;font-weight:600">لوحة تحكم المالك (الشركات والاشتراكات)</a>
      ${hasCompany ? `<button class="pri" id="sc-co" style="background:#fff;color:var(--acc,#0E5A44);border:2px solid var(--acc,#0E5A44)">الدخول إلى نظام شركتي</button>` : ''}
      <div class="row"><button class="lnk" id="sc-out">خروج</button></div>`);
    const b = document.getElementById('sc-co'); if (b) b.onclick = () => { sessionStorage.setItem('fleet-super-co', '1'); entered = false; enter(u); };
    document.getElementById('sc-out').onclick = window.__fbSignOut;
  }

  let entered = false, ENTERED_UID = null;
  async function enter(u) {
    if (entered) return;
    if (!u.emailVerified && !isPhoneAcct(u.email)) return showVerify(u);
    const email = String(u.email).toLowerCase();
    const isSuper = !!SUPER && email === SUPER;
    // أي شركة ينتمي لها المستخدم
    let mem = null;
    try { const m = await F.getDoc(F.doc(fs, 'members', email)); mem = m.exists() ? m.data() : null; } catch (e) { mem = null; }
    if (!mem) {
      if (isSuper) return showSuperChoice(u, false);
      // موظف في فريق المنصة: يذهب للوحة التحكم
      try { const st = await F.getDoc(F.doc(fs, 'staff', email)); if (st.exists() && st.data().active) return showSuperChoice(u, false); } catch (e) {}
      if (isPhoneAcct(u.email)) return showNoAccess(u);
      const p = pend.get();
      return showCreateCompany(u, p && p.email === email ? p : { uname: u.displayName || '' });
    }
    if (isSuper && !sessionStorage.getItem('fleet-super-co')) return showSuperChoice(u, true);
    CID = mem.companyId;
    try { const c = await F.getDoc(F.doc(fs, 'companies', CID)); COMPANY = c.exists() ? c.data() : null; } catch (e) { COMPANY = null; }
    if (!COMPANY) return showNoAccess(u);
    const isOwner = email === String(COMPANY.ownerEmail || '').toLowerCase();
    if (['pending', 'rejected'].includes(COMPANY.status)) return isOwner ? showPending(u) : showNoAccess(u);
    if (!['trial', 'active'].includes(COMPANY.status)) return showSuspended(u);
    let access = null;
    if (!isOwner) {
      try { const s = await F.getDoc(F.doc(fs, P('access'), email)); access = s.exists() ? s.data() : null; } catch (e) { access = null; }
      if (!access) return showNoAccess(u);
    }
    // أول دخول بعد الاعتماد: تُكتب بيانات الشركة الأساسية في إعدادات النظام
    if (isOwner) { try { const sm = await F.getDoc(F.doc(fs, P('settings'), 'main')); if (!sm.exists()) await F.setDoc(F.doc(fs, P('settings'), 'main'), { companyName: COMPANY.name, updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); } }
    entered = true; ENTERED_UID = u.uid;
    window.__plat = {
      company: () => ({ id: CID, ...COMPANY }), isOwner, email,
      token: () => u.getIdToken(),
      invoices: () => coInvoices(CID),
      receipts: async () => { const s = await F.getDocs(F.query(F.collection(fs, 'kyc'), F.where('cid', '==', CID), F.where('kind', '==', 'receipt'))); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
      attachReceipt: (inv, note) => pickFile().then(f => f ? attachReceipt(u, CID, inv, f, note).then(() => true) : false),
      tickets: async () => { const q = isOwner || (await F.getDoc(F.doc(fs, P('access'), email)).then(d => d.data() && d.data().role === 'admin').catch(() => false))
          ? F.query(F.collection(fs, 'tickets'), F.where('cid', '==', CID)) : F.query(F.collection(fs, 'tickets'), F.where('cid', '==', CID), F.where('by', '==', email));
        const s = await F.getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt))); },
      openTicket: async ({ subject, body, category }) => { const now = new Date().toISOString();
        const ref = await F.addDoc(F.collection(fs, 'tickets'), { cid: CID, companyName: COMPANY.name, subject, body, category: category || 'tech', status: 'open', by: email, byName: u.displayName || '', createdAt: now, lastAt: now, lastBy: email, unreadPlat: true, unreadCo: false });
        platNotify({ action: 'ticket', ticketId: ref.id, text: body }); return ref.id; },
      ticketMsgs: async id => { const s = await F.getDocs(F.collection(fs, 'tickets', id, 'msgs')); return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.at).localeCompare(String(b.at))); },
      reply: async (id, text) => { const now = new Date().toISOString();
        await F.addDoc(F.collection(fs, 'tickets', id, 'msgs'), { by: email, byName: u.displayName || '', text, at: now, side: 'co' });
        await F.updateDoc(F.doc(fs, 'tickets', id), { status: 'open', lastAt: now, lastBy: email, unreadPlat: true, unreadCo: false });
        platNotify({ action: 'ticket', ticketId: id, reply: true, text }); },
      seen: id => F.updateDoc(F.doc(fs, 'tickets', id), { unreadCo: false }).catch(() => {}),
      closeTicket: id => F.updateDoc(F.doc(fs, 'tickets', id), { status: 'closed', lastAt: new Date().toISOString(), lastBy: email }),
      pub: () => F.getDoc(F.doc(fs, 'platform', 'public')).then(d => d.exists() ? d.data() : {}).catch(() => ({}))
    };
    // أعطال المتصفح تُرسل لفريق المنصة (5 كحد أقصى في الجلسة، دون بيانات المستخدم)
    if (!window.__errHook) { window.__errHook = 1; let n = 0;
      const rep = (msg, src) => { if (n++ >= 5) return; msg = String(msg || '').slice(0, 500); if (!msg || /ResizeObserver|Script error/.test(msg)) return;
        F.addDoc(F.collection(fs, 'clienterr'), { cid: String(CID || '').slice(0, 40), email, msg, src: String(src || '').slice(0, 300), page: String(location.hash || '#').slice(0, 100), ua: navigator.userAgent.slice(0, 200), at: new Date().toISOString() }).catch(() => {}); };
      window.addEventListener('error', e => rep(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno || ''}`));
      window.addEventListener('unhandledrejection', e => { const r = e.reason || {}; if (r.code && /permission-denied|unavailable|failed-precondition/.test(r.code)) return; rep(r.message || r, (r.stack || '').split('\n')[1] || ''); }); }
    window.__companyId = CID; try { localStorage.setItem('fleet-was-in', '1'); } catch (e) {} window.__company = { id: CID, ...COMPANY }; window.OWNER_EMAIL = String(COMPANY.ownerEmail || '').toLowerCase();
    window.__companySetSys = async sysEmail => { await F.updateDoc(F.doc(fs, 'companies', CID), { sysEmail, updatedAt: new Date().toISOString() }); };
    swPost({ type: 'token', token: await u.getIdToken(), project: FIREBASE_CONFIG.projectId, cid: CID });
    document.getElementById('auth') && (document.getElementById('auth').hidden = true);
    window.claude = makeClaude(u, isOwner, access);
    readyResolve();
  }

  /* ----- طبقة البيانات بنفس واجهة النظام ----- */
  function makeClaude(u, isOwner, access) {
    const me = { id: u.uid, name: u.displayName || access?.name || phoneOf(u.email) || u.email.split('@')[0], email: String(u.email).toLowerCase(), phone: phoneOf(u.email) || '', isOwner };
    const SKIP_AUDIT = new Set(['seen', 'audit', 'blobs', 'access', 'logins', 'pushsubs', 'ids']);
    const label = d => { if (!d) return ''; const p = [d.plateLetters, d.plateNumbers].filter(Boolean).join(' '); return p || d.name || d.kind || d.title || d.ref || ''; };
    async function audit(col, id, action, data, fields) {
      if (SKIP_AUDIT.has(col) || String(col).startsWith('threads')) return;
      try { await F.addDoc(F.collection(fs, P('audit')), { at: new Date().toISOString(), uid: me.id, name: me.name, email: me.phone || me.email, col, docId: id, action, label: label(data), vid: (data && data.vehicleId) || null, fields: fields || null }); } catch (e) {}
    }
    const accKey = d => d && String(d.loginEmail || d.email || '').toLowerCase();
    async function mirrorAccess(id, data, prev) {
      const pe = accKey(prev), ne = accKey(data);
      try {
        if (pe && pe !== ne) {
          await F.deleteDoc(F.doc(fs, P('access'), pe));
          try { await F.deleteDoc(F.doc(fs, 'members', pe)); } catch (e) {}
          if (prev.phone && prev.loginEmail) { try { await F.deleteDoc(F.doc(fs, 'logins', normPhone(prev.phone))); } catch (e) {} }
        }
        if (ne) {
          // فهرس العضوية: يفشل إن كان الإيميل مسجلاً في شركة أخرى
          try { await F.setDoc(F.doc(fs, 'members', ne), { companyId: CID, at: new Date().toISOString() }); }
          catch (e) { const x = new Error('هذا المستخدم مسجل في شركة أخرى على المنصة'); x.code = 'member-conflict'; throw x; }
        }
        if (ne) await F.setDoc(F.doc(fs, P('access'), ne), { role: data.role || 'viewer', alsoDriver: !!(data.alsoDriver && data.driverId), driverId: data.driverId || null, branchId: data.branchId || null, name: data.name || '', phone: data.phone ? normPhone(data.phone) : null, inviteId: id, updatedAt: new Date().toISOString() });
      } catch (e) { console.warn('access', e); if (e.code === 'member-conflict') { window.toast && window.toast(e.message); } }
    }
    const docApi = (col, id) => {
      const ref = F.doc(fs, P(col), id);
      return {
        async set(data) {
          const prev = col === 'invites' ? (await F.getDoc(ref)).data() : null;
          if (col === 'seen' && id === me.id) data = { ...data, name: me.name, email: me.email, phone: me.phone };
          await F.setDoc(ref, data);
          if (col === 'invites') await mirrorAccess(id, data, prev);
          audit(col, id, 'set', data);
        },
        async update(data) {
          const prevI = col === 'invites' ? (await F.getDoc(ref)).data() : null;
          await F.updateDoc(ref, data);
          let cur = null; try { cur = (await F.getDoc(ref)).data(); } catch (e) {}
          if (col === 'invites' && cur) await mirrorAccess(id, cur, prevI);
          audit(col, id, 'update', cur || data, Object.keys(data));
        },
        async delete() {
          let prev = null; try { prev = (await F.getDoc(ref)).data(); } catch (e) {}
          await F.deleteDoc(ref);
          if (col === 'invites' && prev) await mirrorAccess(id, null, prev);
          audit(col, id, 'delete', prev);
        }
      };
    };
    const db = {
      collection(col) {
        return {
          onSnapshot(cb, err) { return F.onSnapshot(F.collection(fs, P(col)), s => cb({ docs: s.docs.map(d => ({ id: d.id, data: () => d.data() })) }), err); },
          async add(data) { const r = await F.addDoc(F.collection(fs, P(col)), data); if (col === 'invites') await mirrorAccess(r.id, data, null); audit(col, r.id, 'add', data); return { id: r.id }; },
          doc: id => docApi(col, id)
        };
      },
      doc(path) { const parts = path.split('/'); const i = parts.pop(); return docApi(parts.join('/'), i); },
      // استعلام مباشر مع تحديث لحظي (للرسائل)
      watch(col, opts, cb, err) {
        const cons = []; (opts.where || []).forEach(w => cons.push(F.where(w[0], w[1], w[2]))); if (opts.orderBy) cons.push(F.orderBy(opts.orderBy[0], opts.orderBy[1] || 'asc')); if (opts.limit) cons.push(F.limit(opts.limit));
        return F.onSnapshot(F.query(F.collection(fs, P(col)), ...cons), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err);
      },
      async merge(col, id, data) { await F.setDoc(F.doc(fs, P(col), id), data, { merge: true }); },
      async addTo(col, data) { const r = await F.addDoc(F.collection(fs, P(col)), data); return r.id; },
      async getOne(col, id) { const s = await F.getDoc(F.doc(fs, P(col), id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
      async recent(col, n) { const s = await F.getDocs(F.query(F.collection(fs, P(col)), F.orderBy('at', 'desc'), F.limit(n || 300))); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
      async importAll(data, onProgress) {
        const items = []; Object.entries(data.collections || {}).forEach(([c, list]) => (list || []).forEach(d => { const { id, ...rest } = d; if (id) items.push([c, id, rest]); }));
        Object.entries(data.blobs || {}).forEach(([id, b]) => chunkBlob(id, b.type, b.data, b.size).forEach(([bid, doc]) => items.push(['blobs', bid, doc])));
        for (let i = 0; i < items.length; i += 400) {
          const b = F.writeBatch(fs); items.slice(i, i + 400).forEach(([c, id, d]) => b.set(F.doc(fs, P(c), id), d)); await b.commit(); onProgress && onProgress(Math.min(items.length, i + 400), items.length);
        }
        for (const iv of (data.collections?.invites || [])) await mirrorAccess(iv.id, iv, null);
        audit('settings', 'import', 'import', { name: 'استيراد بيانات' });
        return items.length;
      }
    };
    const CH = 700000;
    function chunkBlob(id, type, b64, size) {
      const n = Math.max(1, Math.ceil(b64.length / CH)); const out = [];
      out.push([id, { type, size: size || 0, chunks: n, data: b64.slice(0, CH), at: new Date().toISOString(), uid: me.id }]);
      for (let i = 1; i < n; i++) out.push([`${id}__${i}`, { data: b64.slice(i * CH, (i + 1) * CH) }]);
      return out;
    }
    const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
    const assets = {
      async upload(blob, opts) {
        const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
        const type = (opts && opts.type) || blob.type || 'application/octet-stream';
        const b64 = await toB64(blob);
        for (const [bid, d] of chunkBlob(id, type, b64, blob.size)) await F.setDoc(F.doc(fs, P('blobs'), bid), d);
        return { id, url: '_blob/' + id, sizeBytes: blob.size, contentType: type };
      }
    };
    const downloads = {
      async save({ filename, data }) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: /\.pdf$/i.test(filename) ? 'application/pdf' : /\.json$/i.test(filename) ? 'application/json' : /\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : /\.xlsx$/i.test(filename) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/octet-stream' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        return { status: 'saved' };
      }
    };
    const user = {
      async me() { return me; }, async can() { return true; },
      async profiles(ids) { const out = {}; for (const id of [].concat(ids)) { try { const s = await F.getDoc(F.doc(fs, P('seen'), id)); const d = s.data() || {}; out[id] = { id, name: d.name || d.email || '', email: d.email || '' }; } catch (e) { out[id] = { id }; } } return out; },
      async search() { return []; }
    };
    return { use: async x => ({ db, assets, downloads, user })[x] || null, standalone: true };
  }

  AUTH_GO = { login: () => showLogin(), co: () => showCompanySignup() };
  const qp = new URLSearchParams(location.search); let join = qp.get('join') ? { phone: qp.get('join'), code: qp.get('c') || '' } : null;
  A.onAuthStateChanged(auth, async u => {
    if (busyAuth) return;
    if (u && join && normPhone(join.phone) !== phoneOf(u.email)) { await A.signOut(auth); return; }
    // تغيّر الحساب من تبويب آخر (مثل دخول المالك للوحة المنصة): نعيد التحميل بالحساب الجديد
    if (entered && (!u || u.uid !== ENTERED_UID)) { location.reload(); return; }
    if (u) enter(u); else { entered = false;
      join ? showActivate(join) : qp.has('signup') ? showCompanySignup() : showLogin(); } });
}
start().catch(e => { console.error(e); card(`<h2>تعذر تشغيل النظام</h2><p>تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.</p><p class="err" dir="ltr">${esc(e && e.message)}</p>`); });
