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
#auth{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:radial-gradient(1200px 700px at 80% 10%,#13755a 0%,#0E5A44 45%,#0a3d2f 100%);font-family:var(--f-body,"IBM Plex Sans Arabic",sans-serif)}
#auth[hidden]{display:none}
#auth .card{width:min(420px,100%);background:var(--surface,#fff);color:var(--ink,#15201B);border-radius:18px;padding:26px 24px;box-shadow:0 30px 70px rgba(0,0,0,.35);display:grid;gap:14px}
#auth .lg{display:flex;align-items:center;gap:12px}
#auth .lg b{font:700 20px var(--f-display,"Readex Pro",sans-serif)}
#auth .lg small{display:block;color:var(--muted,#5A6862);font-size:13px}
#auth .mk{border:2px solid var(--acc,#0E5A44);color:var(--acc,#0E5A44);border-radius:7px;padding:3px 8px;font:600 12px "IBM Plex Mono",monospace;letter-spacing:.08em}
#auth h2{margin:4px 0 0;font:600 18px var(--f-display,"Readex Pro",sans-serif)}
#auth label{display:grid;gap:5px;font-size:13px;color:var(--muted,#5A6862)}
#auth input{font:inherit;font-size:15px;padding:11px 12px;border:1px solid var(--line,#D6DDD9);border-radius:10px;background:var(--surface-2,#F6F8F7);color:inherit}
#auth input:focus{outline:2px solid var(--acc,#0E5A44);outline-offset:1px}
#auth button.pri{font:600 15px var(--f-display,"Readex Pro",sans-serif);padding:12px;border:0;border-radius:10px;background:var(--acc,#0E5A44);color:#fff;cursor:pointer}
#auth button.pri:disabled{opacity:.6}
#auth .lnk{background:none;border:0;color:var(--acc,#0E5A44);font:inherit;font-size:14px;cursor:pointer;padding:2px}
#auth .row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
#auth .err{color:#B42318;font-size:14px;min-height:1em}
#auth .ok{color:#0E5A44;font-size:14px}
#auth p{margin:0;line-height:1.7;font-size:14px}
.lang-pick{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap}
.lang-pick button{font:500 13px "IBM Plex Sans Arabic",system-ui,sans-serif;padding:6px 12px;min-height:34px;border-radius:17px;border:1px solid var(--line,#D6DDD9);background:transparent;color:inherit;cursor:pointer}
.lang-pick button.on{background:var(--acc,#0E5A44);border-color:var(--acc,#0E5A44);color:#fff}`;
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
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function authRoot() {
  let r = document.getElementById('auth');
  if (!r) { const st = document.createElement('style'); st.textContent = AUTH_CSS; document.head.appendChild(st); r = document.createElement('div'); r.id = 'auth'; document.body.appendChild(r); }
  r.hidden = false; return r;
}
const T = (s, v) => (window.I18N ? window.I18N.t(s, v) : s);
let lastShow = null;
function card(inner) {
  if (window.I18N) window.I18N.use(window.I18N.lang);
  const r = authRoot();
  r.innerHTML = `<div class="card" role="dialog" aria-label="${T('تسجيل الدخول')}">${window.I18N ? window.I18N.picker() : ''}<div class="lg"><span class="mk">KSA</span><div><b>${esc(APP_NAME || T('نظام أسطول الشركة'))}</b><small>${T('إدارة السيارات والسائقين والتكاليف')}</small></div></div>${inner}</div>`;
  r.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { window.I18N.set(b.dataset.lang); window.I18N.use(b.dataset.lang); if (lastShow) lastShow(); });
}

export async function start() {
  if (window.I18N) window.I18N.use(window.I18N.lang);
  const swP = setupSW();
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
  await swP;
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  let fs;
  try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { fs = F.getFirestore(app); }
  const SUPER = String(SUPER_ADMIN_EMAIL || '').toLowerCase();
  let CID = null, COMPANY = null;
  const P = c => `companies/${CID}/${c}`;

  A.onIdTokenChanged(auth, async u => { if (u && CID) swPost({ type: 'token', token: await u.getIdToken(), project: FIREBASE_CONFIG.projectId, cid: CID }); });
  navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data && e.data.type === 'need-token' && auth.currentUser && CID) swPost({ type: 'token', token: await auth.currentUser.getIdToken(), project: FIREBASE_CONFIG.projectId, cid: CID });
  });
  window.__fbIdToken = async () => auth.currentUser ? auth.currentUser.getIdToken() : null;
  window.__fbSignOut = async () => { try { (await caches.keys()).forEach(k => caches.delete(k)); } catch (e) {} await A.signOut(auth); location.reload(); };

  /* ----- شاشات الدخول ----- */
  function showLogin(msg) {
    lastShow = () => showLogin(msg);
    card(`<h2>${T('تسجيل الدخول')}</h2>
      <form id="af" style="display:grid;gap:12px">
      <label>${T('رقم الجوال')}<input id="ae" type="text" inputmode="tel" dir="ltr" placeholder="05xxxxxxxx" autocomplete="username" required></label>
      <label>${T('كلمة المرور')}<input id="ap" type="password" dir="ltr" autocomplete="current-password" required></label>
      <div class="err" id="aerr">${esc(msg || '')}</div>
      <button class="pri" id="ab">${T('دخول')}</button></form>
      <div class="row"><button class="lnk" id="a-new">${T('مستخدم جديد؟ فعّل حسابك')}</button><button class="lnk" id="a-rst">${T('نسيت كلمة المرور')}</button></div>
      <div class="row" style="border-top:1px solid var(--line,#D6DDD9);padding-top:12px"><span style="font-size:14px">${T('شركة جديدة؟')}</span><button class="lnk" id="a-co">${T('سجّل شركتك')}</button></div>`);
    const f = document.getElementById('af');
    f.onsubmit = async e => { e.preventDefault(); const b = document.getElementById('ab'); b.disabled = true;
      const id = f.ae.value.trim(); const er = document.getElementById('aerr');
      try {
        let email = id;
        if (!id.includes('@')) {
          const ph = normPhone(id); if (!/^05\d{8}$/.test(ph)) { er.textContent = T('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام'); b.disabled = false; return; }
          const s = await F.getDoc(F.doc(fs, 'logins', ph));
          if (!s.exists()) { er.textContent = T('هذا الرقم غير مفعّل بعد. افتح رابط الدعوة الذي وصلك من مدير النظام لتفعيل حسابك.'); b.disabled = false; return; }
          email = s.data().email;
        }
        await A.signInWithEmailAndPassword(auth, email, f.ap.value);
      } catch (err) { er.textContent = err.code === 'auth/invalid-credential' ? T('رقم الجوال أو كلمة المرور غير صحيحة') : (window.I18N && window.I18N.ui !== 'ar' ? T('تعذر الدخول، حاول مرة أخرى') : (ERR[err.code] || 'تعذر الدخول، حاول مرة أخرى')); b.disabled = false; } };
    setTimeout(() => document.getElementById('ae').focus(), 50);
    document.getElementById('a-new').onclick = () => showActivate();
    document.getElementById('a-co').onclick = () => showCompanySignup();
    document.getElementById('a-rst').onclick = () => { const v = document.getElementById('ae').value; v.includes('@') ? showReset(v) : showForgotPhone(); };
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
    setTimeout(() => document.getElementById('cn').focus(), 50);
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
        if (ne) await F.setDoc(F.doc(fs, P('access'), ne), { role: data.role || 'viewer', driverId: data.driverId || null, branchId: data.branchId || null, name: data.name || '', phone: data.phone ? normPhone(data.phone) : null, inviteId: id, updatedAt: new Date().toISOString() });
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

  const qp = new URLSearchParams(location.search); let join = qp.get('join') ? { phone: qp.get('join'), code: qp.get('c') || '' } : null;
  A.onAuthStateChanged(auth, async u => {
    if (busyAuth) return;
    if (u && join && normPhone(join.phone) !== phoneOf(u.email)) { await A.signOut(auth); return; }
    // تغيّر الحساب من تبويب آخر (مثل دخول المالك للوحة المنصة): نعيد التحميل بالحساب الجديد
    if (entered && (!u || u.uid !== ENTERED_UID)) { location.reload(); return; }
    if (u) enter(u); else { entered = false;
      // الزائر الجديد يرى الصفحة التعريفية، ومن ضغط «دخول» أو فتح التطبيق المثبّت يرى شاشة الدخول
      const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      if (!join && !qp.has('signup') && !qp.has('login') && !app && !localStorage.getItem('fleet-was-in')) { location.replace('welcome.html'); return; }
      join ? showActivate(join) : qp.has('signup') ? showCompanySignup() : showLogin(); } });
}
start().catch(e => { console.error(e); card(`<h2>تعذر تشغيل النظام</h2><p>تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.</p><p class="err" dir="ltr">${esc(e && e.message)}</p>`); });
