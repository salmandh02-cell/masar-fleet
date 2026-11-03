// مهمة المنصة اليومية: تنبيه الشركات قبل انتهاء التجربة أو الاشتراك، والإيقاف التلقائي بعد الانتهاء
const P = require('./plat-core');
const NOTICE_DAYS = [7, 3, 1];
const days = (end, today) => Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);

async function run(tok, opts = {}) {
  const today = opts.today || new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  let set = {}; try { set = (await P.get(tok, 'platform/settings')) || {}; } catch (e) {}
  if (set.autoSuspend === 'off') return { skipped: 'disabled' };
  const grace = Math.max(0, +(set.graceDays ?? 3) || 0);
  const site = P.SITE(); const out = { notices: 0, suspended: [] };
  for (const c of await P.list(tok, 'companies')) {
    if (!['trial', 'active'].includes(c.status)) continue;
    const trial = c.status === 'trial'; const end = trial ? c.trialEnds : c.paidUntil;
    if (!end) continue;
    const d = days(end, today);
    const what = trial ? 'التجربة المجانية' : 'الاشتراك';
    if (NOTICE_DAYS.includes(d) && c.lastNotice !== `${end}:${d}`) {
      const title = `${what} تنتهي خلال ${d === 1 ? 'يوم واحد' : d + ' أيام'}`;
      await P.mail(c.ownerEmail, `${title} – ${c.name}`, `<p>مرحباً ${P.esc(c.ownerName || '')}،</p><p>${what} لحساب <b>${P.esc(c.name)}</b> تنتهي في <b>${P.esc(end)}</b>. ${trial ? 'اشترك الآن ليستمر عملك دون انقطاع.' : 'جدّد اشتراكك قبل هذا التاريخ ليستمر عملك دون انقطاع.'}</p>${P.btn(site + '/#billing', 'الاشتراك والفواتير')}`);
      await P.notifyCompanyUser(tok, c.id, c.ownerEmail, { title, body: c.name, url: './#billing', tag: 'exp-' + c.id });
      await P.patch(tok, `companies/${c.id}`, { lastNotice: `${end}:${d}`, updatedAt: new Date().toISOString() });
      out.notices++;
    }
    // التجربة تُوقف يوم انتهائها، والاشتراك المدفوع بعد مهلة السماح
    if (d < (trial ? 0 : -grace)) {
      await P.patch(tok, `companies/${c.id}`, { status: 'suspended', suspendedAt: new Date().toISOString(), suspendReason: trial ? 'انتهت التجربة' : 'انتهى الاشتراك', updatedAt: new Date().toISOString() });
      await P.mail(c.ownerEmail, `تم إيقاف حساب ${c.name}`, `<p>انتهت ${what} لحساب <b>${P.esc(c.name)}</b> وأُوقف الحساب مؤقتاً. بياناتك محفوظة كما هي، وتعود كاملة فور الاشتراك أو التجديد.</p>${P.btn(site + '/#billing', 'الاشتراك والفواتير')}`);
      out.suspended.push(c.id);
    }
  }
  if (out.suspended.length) await P.notifyStaff(tok, ['manager', 'accounts'], { title: 'إيقاف تلقائي', body: `أُوقفت ${out.suspended.length} شركة لانتهاء التجربة أو الاشتراك`, url: 'admin.html', tag: 'auto-' + today });
  return out;
}
module.exports = { run };
