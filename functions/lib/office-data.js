// بيانات الموظف عند التشغيل التلقائي على الخادم (نسخة مختصرة مما تجهّزه لوحة المالك في ofData)
// تُقرأ بحساب النظام، بدون أرقام هويات أو كلمات مرور
const P = require('./plat-core');
const ksaDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const fmt = d => String(d || '').slice(0, 10);
const daysLeft = (d, t) => d ? Math.round((Date.parse(String(d).slice(0, 10) + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 864e5) : null;
const daysAgo = (d, t) => d ? -daysLeft(d, t) : null;
const ST = { active: 'مفعّلة', trial: 'تجربة', suspended: 'موقوفة', expired: 'منتهية', pending: 'بانتظار الاعتماد', rejected: 'مرفوضة' };
const stOf = (c, t) => c.status === 'trial' && c.trialEnds && c.trialEnds < t ? 'expired' : c.status === 'active' && c.paidUntil && c.paidUntil < t ? 'expired' : (c.status || 'trial');
const isOpen = c => ['pending', 'rejected'].includes(c.status);
const istOf = (i, t) => i.status === 'unpaid' && i.dueDate && i.dueDate < t ? 'overdue' : i.status;
const TK_CAT = { tech: 'مشكلة تقنية', billing: 'الفواتير والاشتراك', feature: 'اقتراح ميزة', training: 'تدريب واستفسار', other: 'أخرى' };
const TK_ST = { open: 'بانتظار الرد', answered: 'تم الرد', closed: 'مغلقة' };
const safe = p => p.catch(() => []);
const r2 = n => Math.round((+n || 0) * 100) / 100;

// رسائل تذكرة واحدة بالترتيب
async function ticketMsgs(tok, t) {
  const msgs = (await safe(P.list(tok, `tickets/${t.id}/msgs`))).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return [{ من: 'العميل', نص: cut(t.body, 1500) }, ...msgs.slice(-8).map(m => ({ من: m.side === 'plat' ? 'فريق المنصة' : 'العميل', نص: cut(m.text, 1000) }))];
}

async function build(tok, emp, office) {
  const t = ksaDay(); const [cos, stats] = await Promise.all([safe(P.list(tok, 'companies')), safe(P.list(tok, 'platstats'))]);
  const S = Object.fromEntries(stats.map(x => [x.id, x])); const live = cos.filter(c => !isOpen(c));
  const coRow = c => { const st = S[c.id] || {}; const p = c.profile || {};
    return { id: c.id, الاسم: c.name, الحالة: ST[stOf(c, t)] || c.status, المدينة: p.city || '', المسؤول: p.contactName || c.ownerName || '', سجل_في: fmt(c.createdAt), اعتمد_في: fmt(c.approvedAt),
      تنتهي_التجربة: c.status === 'trial' ? fmt(c.trialEnds) : '', مدفوع_حتى: c.paidUntil || '', الأيام_المتبقية: daysLeft(c.status === 'trial' ? c.trialEnds : c.paidUntil, t),
      السيارات: st.vehicles ?? '', المستخدمون: st.users ?? '', آخر_نشاط: fmt(st.lastSeen), المستندات_المرفوعة: Array.isArray(c.docs) ? c.docs.length : (c.crNumber ? 'رقم السجل مدخل' : '') }; };
  const d = { عام: { المنصة: P.APP(), اليوم: t, الشركات_المشتركة: live.length, في_التجربة: live.filter(c => stOf(c, t) === 'trial').length, طلبات_معلقة: cos.filter(c => c.status === 'pending').length, التشغيل: 'تلقائي مجدول' } };
  const needInv = ['accountant', 'coo', 'sales'].includes(emp); const invs = needInv ? await safe(P.list(tok, 'invoices')) : [];
  const needTk = ['support', 'coo', 'ideas'].includes(emp); const tks = needTk ? (await safe(P.list(tok, 'tickets'))).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt))) : [];
  if (emp === 'support') {
    const act = tks.filter(x => x.status !== 'closed').slice(0, 15);
    d.تذاكر_مفتوحة = await Promise.all(act.map(async x => ({ id: x.id, الشركة: x.companyName, التصنيف: TK_CAT[x.category] || x.category || '', الحالة: TK_ST[x.status] || x.status, الموضوع: x.subject, فُتحت: fmt(x.createdAt), آخر_تحديث: String(x.lastAt || '').slice(0, 16), الرسائل: await ticketMsgs(tok, x) })));
    d.تذاكر_مغلقة_حديثاً = tks.filter(x => x.status === 'closed').slice(0, 30).map(x => ({ الموضوع: x.subject, التصنيف: TK_CAT[x.category] || '' }));
  }
  if (emp === 'sales') {
    d.طلبات_التسجيل = cos.filter(c => c.status === 'pending').map(c => ({ ...coRow(c), ينتظر_منذ_أيام: daysAgo(c.submittedAt || c.createdAt, t), السجل_التجاري: c.crNumber ? 'مدخل' : 'غير مدخل', الرقم_الضريبي: c.vatNumber ? 'مدخل' : 'غير مدخل', الهاتف: c.phone || (c.profile || {}).phone ? 'مدخل' : 'غير مدخل' }));
    d.شركات_التجربة = live.filter(c => stOf(c, t) === 'trial').map(coRow);
    d.قريبة_من_التجديد = live.filter(c => stOf(c, t) === 'active' && (daysLeft(c.paidUntil, t) ?? 99) <= 14).map(coRow);
    d.منتهية_غير_مجددة = live.filter(c => stOf(c, t) === 'expired').map(coRow);
  }
  if (emp === 'accountant') {
    const B = (await P.get(tok, 'platform/books').catch(() => null)) || {}; const from = new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10);
    d.فواتير_غير_مدفوعة = invs.filter(i => i.status === 'unpaid').map(i => ({ الرقم: i.number, الشركة: i.companyName, المبلغ: i.total, صدرت: fmt(i.issueDate), الاستحقاق: fmt(i.dueDate), متأخرة: istOf(i, t) === 'overdue' ? 'نعم' : 'لا', إيصال_مرفوع: i.receiptId ? 'نعم' : 'لا' }));
    d.فواتير_مدفوعة_حديثاً = invs.filter(i => i.status === 'paid' && String(i.paidAt || '') >= from).slice(0, 40).map(i => ({ الرقم: i.number, الشركة: i.companyName, المبلغ: i.total, دُفعت: fmt(i.paidAt), طريقة_الدفع: i.payMethod || i.method || (i.paymentId ? 'دفع إلكتروني' : 'تحويل'), سند_قبض: i.receiptNo || i.voucher || (i.receiptId ? 'إيصال تحويل' : 'لا يوجد') }));
    const ex = (B.expenses || []).filter(x => String(x.date) >= from);
    d.المصروفات_الأخيرة = ex.slice(-60).map(x => ({ التاريخ: x.date, النوع: x.kind === 'inc' ? 'إيراد' : 'مصروف', الحساب: x.acc, الوصف: cut(x.desc, 80), المبلغ: x.amount }));
    const seen = {}; d.قيود_محتملة_التكرار = ex.filter(x => { const k = `${x.date}|${x.amount}|${x.acc}`; seen[k] = (seen[k] || 0) + 1; return seen[k] === 2; }).map(x => ({ التاريخ: x.date, المبلغ: x.amount, الحساب: x.acc, الوصف: cut(x.desc, 80) }));
    d.دليل_الحسابات = (B.accounts || []).map(a => `${a.code} ${a.name}`).slice(0, 200);
    d.قيود_اليومية_الأخيرة = (B.journal || []).slice(-15).map(j => ({ التاريخ: j.date, البيان: cut(j.desc, 100) }));
    d.ملاحظة = 'الفواتير المدفوعة والمصروفات المسجلة تُرحّل تلقائياً. لا تكتب قيداً لها، واكتب مسودة task أو report بما يحتاج قرار المالك.';
  }
  if (emp === 'ideas') {
    const errs = (await safe(P.list(tok, 'clienterr'))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200); const g = {};
    errs.forEach(e => { const k = cut(e.msg, 200); const x = g[k] || (g[k] = { الخطأ: k, المرات: 0, الصفحة: e.page }); x.المرات++; });
    d.أعطال_المتصفح = Object.values(g).sort((a, b) => b.المرات - a.المرات).slice(0, 20);
    d.تذاكر_تقنية_واقتراحات = tks.filter(x => ['tech', 'feature', 'training'].includes(x.category)).slice(0, 30).map(x => ({ النوع: TK_CAT[x.category], الموضوع: x.subject, التفاصيل: cut(x.body, 500) }));
    d.مقترحات_سابقة = (office.drafts || []).filter(x => x.kind === 'idea').slice(0, 30).map(x => ({ العنوان: x.title, الحالة: x.status === 'new' ? 'بانتظار المالك' : x.status === 'skip' ? 'رفضها المالك' : 'اعتُمدت' }));
  }
  if (emp === 'coo' || emp === 'ceo') {
    const age = x => daysAgo(x.at, t) ?? 0; const dr = office.drafts || [];
    d.مسودات_معلقة_عند_المالك = dr.filter(x => x.status === 'new').slice(0, 40).map(x => ({ الموظف: x.emp, العنوان: x.title, النوع: x.kind, منذ_أيام: age(x) }));
    d.سير_العمل_الأخير = (office.feed || []).slice(0, 30).map(f => `${String(f.at).slice(0, 16).replace('T', ' ')} · ${f.emp}${f.to ? ' ← ' + f.to : ''}: ${f.text}`);
    d.المؤشرات = { تذاكر_مفتوحة: tks.filter(x => x.status === 'open').length, تذاكر_بلا_رد_أكثر_من_يوم: tks.filter(x => x.status === 'open' && (daysAgo(x.lastAt, t) || 0) >= 1).length,
      فواتير_متأخرة: invs.filter(i => istOf(i, t) === 'overdue').length, طلبات_تسجيل_معلقة: cos.filter(c => c.status === 'pending').length, طابور_البرمجة: (office.queue || []).filter(x => x.status === 'queued').length };
    d.تقييمات_الخبراء = Object.fromEntries(Object.entries(office.reviews || {}).map(([k, v]) => [k, v ? `${v.score}/10: ${cut(v.summary, 150)}` : '']));
  }
  if (emp === 'legal') {
    d.المنصة = { الوصف: 'منصة سحابية (SaaS) لإدارة أساطيل المركبات تبيع اشتراكات للمنشآت في السعودية', البيانات_المعالجة: 'بيانات المنشآت ومستخدميها والسائقين والمحاضر والمخالفات والحوادث', الاستضافة: 'Google Cloud / Firebase وNetlify', الدفع: 'بوابة ميسّر', الذكاء_الاصطناعي: 'Anthropic' };
    const kb = (await P.get(tok, 'platform/officekb').catch(() => null)) || {};
    d.المراجع_المحفوظة = (kb.docs || []).map(r => ({ العنوان: r.title, أضيف: fmt(r.at) }));
    d.مراجع_نظامية_سابقة = (office.drafts || []).filter(x => x.kind === 'law').slice(0, 30).map(x => ({ العنوان: x.title, الحالة: x.status === 'new' ? 'بانتظار المالك' : x.status === 'skip' ? 'رفضها المالك' : 'حُفظت' }));
  }
  if (emp === 'ops' || emp === 'marketing') d.الشركات = live.map(coRow);
  return JSON.stringify(d, null, 1);
}

// المراجع التي يقرؤها الموظف (نفس منطق اللوحة: قرّاء المرجع أو قرّاء تصنيفه)
function refsFor(kb, rcat, emp, max = 110000) { let out = '';
  for (const r of (kb && kb.docs) || []) { const rd = r.emps && r.emps.length ? r.emps : ((rcat || {})[r.cat] || (rcat || {}).other || []); if (!rd.includes(emp)) continue;
    const x = `### «${r.title}» (${fmt(r.at)})\n${r.text}\n\n`; if (out.length + x.length > max) continue; out += x; }
  return out.trim(); }

module.exports = { build, ticketMsgs, refsFor, ksaDay, stOf, daysLeft, TK_CAT };
