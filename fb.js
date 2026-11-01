// طبقة الربط بين النظام و Firebase (الدخول، قاعدة البيانات، الصور، التنزيل، سجل التدقيق)
import { FIREBASE_CONFIG, OWNER_EMAIL } from './config.js';
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
  r.innerHTML = `<div class="card" role="dialog" aria-label="${T('تسجيل الدخول')}">${window.I18N ? window.I18N.picker() : ''}<div class="lg"><span class="mk">KSA</span><div><b>${T('نظام أسطول الشركة')}</b><small>${T('إدارة السيارات والسائقين والتكاليف')}</small></div></div>${inner}</div>`;
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
  const OWNER = String(OWNER_EMAIL).toLowerCase();

  A.onIdTokenChanged(auth, async u => { if (u) swPost({ type: 'token', token: await u.getIdToken(), project: FIREBASE_CONFIG.projectId }); });
  navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data && e.data.type === 'need-token' && auth.currentUser) swPost({ type: 'token', token: await auth.currentUser.getIdToken(), project: FIREBASE_CONFIG.projectId });
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
      <div class="row"><button class="lnk" id="a-new">${T('مستخدم جديد؟ فعّل حسابك')}</button><button class="lnk" id="a-rst">${T('نسيت كلمة المرور')}</button></div>`);
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
        const a = await F.getDoc(F.doc(fs, 'access', email));
        if (!a.exists()) { try { await c.user.delete(); } catch (x) {} er.textContent = T('رمز التفعيل غير صحيح أو انتهى. اطلب رمزاً جديداً من مدير النظام.'); b.disabled = false; busyAuth = false; return; }
        await A.updateProfile(c.user, { displayName: document.getElementById('sn').value.trim() });
        await F.setDoc(F.doc(fs, 'logins', ph), { email, phone: ph, at: new Date().toISOString() });
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

  let entered = false;
  async function enter(u) {
    if (entered) return;
    if (!u.emailVerified && !isPhoneAcct(u.email)) return showVerify(u);
    const email = String(u.email).toLowerCase();
    const isOwner = email === OWNER;
    let access = null;
    if (!isOwner) {
      try { const s = await F.getDoc(F.doc(fs, 'access', email)); access = s.exists() ? s.data() : null; } catch (e) { access = null; }
      if (!access) return showNoAccess(u);
    }
    entered = true;
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
      try { await F.addDoc(F.collection(fs, 'audit'), { at: new Date().toISOString(), uid: me.id, name: me.name, email: me.phone || me.email, col, docId: id, action, label: label(data), vid: (data && data.vehicleId) || null, fields: fields || null }); } catch (e) {}
    }
    const accKey = d => d && String(d.loginEmail || d.email || '').toLowerCase();
    async function mirrorAccess(id, data, prev) {
      const pe = accKey(prev), ne = accKey(data);
      try {
        if (pe && pe !== ne) {
          await F.deleteDoc(F.doc(fs, 'access', pe));
          if (prev.phone && prev.loginEmail) { try { await F.deleteDoc(F.doc(fs, 'logins', normPhone(prev.phone))); } catch (e) {} }
        }
        if (ne) await F.setDoc(F.doc(fs, 'access', ne), { role: data.role || 'viewer', driverId: data.driverId || null, branchId: data.branchId || null, name: data.name || '', phone: data.phone ? normPhone(data.phone) : null, inviteId: id, updatedAt: new Date().toISOString() });
      } catch (e) { console.warn('access', e); }
    }
    const docApi = (col, id) => {
      const ref = F.doc(fs, col, id);
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
          onSnapshot(cb, err) { return F.onSnapshot(F.collection(fs, col), s => cb({ docs: s.docs.map(d => ({ id: d.id, data: () => d.data() })) }), err); },
          async add(data) { const r = await F.addDoc(F.collection(fs, col), data); if (col === 'invites') await mirrorAccess(r.id, data, null); audit(col, r.id, 'add', data); return { id: r.id }; },
          doc: id => docApi(col, id)
        };
      },
      doc(path) { const parts = path.split('/'); const i = parts.pop(); return docApi(parts.join('/'), i); },
      // استعلام مباشر مع تحديث لحظي (للرسائل)
      watch(col, opts, cb, err) {
        const cons = []; (opts.where || []).forEach(w => cons.push(F.where(w[0], w[1], w[2]))); if (opts.orderBy) cons.push(F.orderBy(opts.orderBy[0], opts.orderBy[1] || 'asc')); if (opts.limit) cons.push(F.limit(opts.limit));
        return F.onSnapshot(F.query(F.collection(fs, col), ...cons), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err);
      },
      async merge(col, id, data) { await F.setDoc(F.doc(fs, col, id), data, { merge: true }); },
      async addTo(col, data) { const r = await F.addDoc(F.collection(fs, col), data); return r.id; },
      async getOne(col, id) { const s = await F.getDoc(F.doc(fs, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
      async recent(col, n) { const s = await F.getDocs(F.query(F.collection(fs, col), F.orderBy('at', 'desc'), F.limit(n || 300))); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
      async importAll(data, onProgress) {
        const items = []; Object.entries(data.collections || {}).forEach(([c, list]) => (list || []).forEach(d => { const { id, ...rest } = d; if (id) items.push([c, id, rest]); }));
        Object.entries(data.blobs || {}).forEach(([id, b]) => chunkBlob(id, b.type, b.data, b.size).forEach(([bid, doc]) => items.push(['blobs', bid, doc])));
        for (let i = 0; i < items.length; i += 400) {
          const b = F.writeBatch(fs); items.slice(i, i + 400).forEach(([c, id, d]) => b.set(F.doc(fs, c, id), d)); await b.commit(); onProgress && onProgress(Math.min(items.length, i + 400), items.length);
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
        for (const [bid, d] of chunkBlob(id, type, b64, blob.size)) await F.setDoc(F.doc(fs, 'blobs', bid), d);
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
      async profiles(ids) { const out = {}; for (const id of [].concat(ids)) { try { const s = await F.getDoc(F.doc(fs, 'seen', id)); const d = s.data() || {}; out[id] = { id, name: d.name || d.email || '', email: d.email || '' }; } catch (e) { out[id] = { id }; } } return out; },
      async search() { return []; }
    };
    return { use: async x => ({ db, assets, downloads, user })[x] || null, standalone: true };
  }

  const qp = new URLSearchParams(location.search); let join = qp.get('join') ? { phone: qp.get('join'), code: qp.get('c') || '' } : null;
  A.onAuthStateChanged(auth, async u => {
    if (busyAuth) return;
    if (u && join && normPhone(join.phone) !== phoneOf(u.email)) { await A.signOut(auth); return; }
    if (u) enter(u); else { entered = false; join ? showActivate(join) : showLogin(); } });
}
start().catch(e => { console.error(e); card(`<h2>تعذر تشغيل النظام</h2><p>تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.</p><p class="err" dir="ltr">${esc(e && e.message)}</p>`); });
