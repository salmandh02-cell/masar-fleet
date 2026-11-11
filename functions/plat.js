// دالة المنصة: إشعارات التسجيل والاعتماد والإيصالات والتذاكر، والتحقق من الدفع الإلكتروني (ميسر)
// كل طلب يُتحقق من صاحبه برمز الدخول، ويُقرأ المستند المعني بصلاحيته هو قبل أي إرسال
const P = require('./lib/plat-core');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const okId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{3,60}$/.test(s);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return J(405, { error: 'POST only' });
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return J(400, { error: 'bad json' }); }
  try {
    if (req.action === 'pay-verify') return J(200, await payVerify(req));
    const auth = event.headers.authorization || event.headers.Authorization || '';
    if (!auth.startsWith('Bearer ')) return J(401, { error: 'no token' });
    const tok = auth.slice(7); const me = await P.whoIs(tok);
    if (!me || !me.email) return J(401, { error: 'bad token' });
    const site = P.SITE();

    // مالك المنصة: تجهيز الحساب الآلي (يُسجَّل في فريق المنصة بدور system)
    if (req.action === 'sys-setup') {
      if (me.email !== P.SUPER() || !me.verified) return J(403, { error: 'owner only' });
      const s = await require('./lib/remind-core').systemLogin(true); return J(200, { email: s.email });
    }
    // أدوات مالك المنصة التقنية: حالة الإعدادات، تحديث الإحصاءات، واختبار البريد والإشعارات والذكاء
    if (['health', 'stats-now', 'test-mail', 'test-push', 'test-ai'].includes(req.action)) {
      const s = await P.sys(); let role = '';
      if (me.email === P.SUPER() && me.verified) role = 'owner';
      else { const st = await P.get(s, `staff/${encodeURIComponent(me.email)}`).catch(() => null); if (st && st.active) role = st.role; }
      if (!['owner', 'manager'].includes(role)) return J(403, { error: 'owner only' });
      const S = require('./lib/plat-stats');
      if (req.action === 'health') return J(200, { config: S.config(), time: new Date().toISOString() });
      if (req.action === 'stats-now') return J(200, await S.run(s));
      if (req.action === 'test-mail') { const r = await P.mail(me.email, 'رسالة اختبار من لوحة المنصة', '<p>وصلت هذه الرسالة من لوحة المنصة، يعني أن إعدادات البريد تعمل ✓</p>'); return J(200, r); }
      if (req.action === 'test-push') { const subs = (await P.list(s, 'platpush').catch(() => [])).filter(x => String(x.key).toLowerCase() === me.email).map(x => ({ ...x, _path: 'platpush/' + x.id }));
        return J(200, { devices: subs.length, pushed: subs.length ? await P.pushSubs(s, subs, { title: 'إشعار اختبار', body: 'الإشعارات تعمل على هذا الجهاز ✓', url: 'admin.html#health', tag: 'test' }) : 0 }); }
      if (req.action === 'test-ai') {
        if (!process.env.ANTHROPIC_API_KEY) return J(200, { ok: false, error: 'no key' });
        const A = require('@anthropic-ai/sdk'); const t0 = Date.now();
        try { const c = new (A.default || A)({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 20000 });
          const m = await c.messages.create({ model: S.config().aiModel, max_tokens: 16, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: 'Reply with: ok' }] });
          return J(200, { ok: true, model: m.model, ms: Date.now() - t0 }); }
        catch (e) { return J(200, { ok: false, error: String(e.status || '') + ' ' + String(e.message || '').slice(0, 160) }); }
      }
    }
    // طلب تسجيل جديد ← فريق المراجعة
    if (req.action === 'signup') {
      if (!okId(req.cid)) return J(400, { error: 'cid' });
      const c = await P.get(tok, `companies/${req.cid}`);
      if (!c || c.ownerEmail !== me.email || c.status !== 'pending') return J(403, { error: 'not allowed' });
      const s = await P.sys(); const p = c.profile || {};
      const out = await P.notifyStaff(s, ['manager', 'accounts', 'sales'], { title: 'طلب تسجيل شركة جديد', body: `${c.name} · ${p.city || ''}`, url: 'admin.html', tag: 'signup-' + req.cid },
        `طلب تسجيل جديد: ${c.name}`, `<p>وصل طلب تسجيل شركة جديد بانتظار المراجعة:</p><p><b>${P.esc(c.name)}</b><br>السجل التجاري: ${P.esc(p.crNumber || '—')}<br>المدينة: ${P.esc(p.city || '—')}<br>المسؤول: ${P.esc(p.contactName || c.ownerName || '')} · ${P.esc(p.contactMobile || c.phone || '')}</p>${P.btn(site + '/admin.html', 'فتح لوحة المنصة')}`);
      const ack = await P.mail(c.ownerEmail, `استلمنا طلب تسجيل ${c.name}`, `<p>مرحباً ${P.esc(c.ownerName || '')}،</p><p>استلمنا طلب تسجيل <b>${P.esc(c.name)}</b>. سيتواصل معك فريقنا للتحقق من البيانات، وتصلك رسالة عند اعتماد الحساب.</p>`);
      return J(200, { ...out, ack });
    }
    // قرار الاعتماد أو الرفض ← الشركة
    if (req.action === 'decision') {
      if (!okId(req.cid)) return J(400, { error: 'cid' });
      const c = await P.get(tok, `companies/${req.cid}`); // يقرأها فريق المنصة فقط (أو الشركة نفسها)
      if (!c || c.ownerEmail === me.email) return J(403, { error: 'not allowed' });
      if (me.email !== P.SUPER() && !(await P.get(await P.sys(), `staff/${encodeURIComponent(me.email)}`).catch(() => null))) return J(403, { error: 'staff only' });
      if (c.status === 'rejected') return J(200, { mailed: await P.mail(c.ownerEmail, `طلب تسجيل ${c.name} يحتاج تعديلاً`, `<p>مرحباً ${P.esc(c.ownerName || '')}،</p><p>راجعنا طلب تسجيل <b>${P.esc(c.name)}</b> ولم يُعتمد بعد، والسبب:</p><p style="background:#FEF3F2;padding:10px;border-radius:8px">${P.esc(c.rejectReason || '')}</p><p>ادخل حسابك وعدّل البيانات ثم أعد إرسال الطلب.</p>${P.btn(site + '/?login=1', 'الدخول للحساب')}`) });
      if (['trial', 'active'].includes(c.status)) return J(200, { mailed: await P.mail(c.ownerEmail, `تم اعتماد حساب ${c.name} ✓`, `<p>مرحباً ${P.esc(c.ownerName || '')}،</p><p>يسعدنا إبلاغك باعتماد حساب <b>${P.esc(c.name)}</b>. ${c.status === 'trial' ? `تبدأ تجربتك المجانية الآن وتنتهي في ${P.esc(c.trialEnds || '')}.` : `اشتراكك فعّال حتى ${P.esc(c.paidUntil || '')}.`}</p>${P.btn(site + '/?login=1', 'الدخول للنظام')}`) });
      return J(200, { skipped: c.status });
    }
    // الشركة أرفقت إيصال تحويل ← المحاسبة
    if (req.action === 'receipt') {
      if (!okId(req.invoiceId)) return J(400, { error: 'invoice' });
      const i = await P.get(tok, `invoices/${req.invoiceId}`);
      if (!i || !i.receiptId || i.receiptBy !== me.email) return J(403, { error: 'not allowed' });
      const s = await P.sys();
      return J(200, await P.notifyStaff(s, ['manager', 'accounts', 'accountant'], { title: 'إيصال تحويل جديد', body: `${i.companyName} · ${i.number} · ${i.total} ريال`, url: 'admin.html#invoices', tag: 'rcpt-' + req.invoiceId },
        `إيصال تحويل: ${i.number}`, `<p>أرفقت <b>${P.esc(i.companyName)}</b> إيصال تحويل للفاتورة <b dir="ltr">${P.esc(i.number)}</b> بمبلغ ${P.esc(i.total)} ريال.</p><p>راجع الإيصال وسجّل الدفع من لوحة المنصة.</p>${P.btn(site + '/admin.html', 'فتح الفواتير')}`));
    }
    // تذكرة دعم جديدة أو رد ← الطرف الآخر
    if (req.action === 'ticket') {
      if (!okId(req.ticketId)) return J(400, { error: 'ticket' });
      const t = await P.get(tok, `tickets/${req.ticketId}`); if (!t) return J(403, { error: 'not allowed' });
      const s = await P.sys();
      const fromPlat = me.email === P.SUPER() || !!(await P.get(s, `staff/${encodeURIComponent(me.email)}`).catch(() => null));
      if (fromPlat) {
        const pushed = await P.notifyCompanyUser(s, t.cid, t.by, { title: 'رد من الدعم الفني', body: t.subject, url: './#support', tag: 'tk-' + req.ticketId });
        const mailed = await P.mail(t.by, `رد على تذكرتك: ${t.subject}`, `<p>وصلك رد من فريق الدعم الفني على تذكرة «${P.esc(t.subject)}».</p>${req.text ? `<p style="background:#F6F8F7;padding:10px;border-radius:8px">${P.esc(String(req.text).slice(0, 1500))}</p>` : ''}${P.btn(site + '/#support', 'فتح التذكرة')}`);
        return J(200, { pushed, mailed });
      }
      return J(200, await P.notifyStaff(s, ['manager', 'support'], { title: req.reply ? 'رد على تذكرة دعم' : 'تذكرة دعم جديدة', body: `${t.companyName} · ${t.subject}`, url: 'admin.html#support', tag: 'tk-' + req.ticketId },
        `${req.reply ? 'رد على تذكرة' : 'تذكرة دعم جديدة'}: ${t.subject}`, `<p><b>${P.esc(t.companyName)}</b> · ${P.esc(t.byName || t.by)}</p><p><b>${P.esc(t.subject)}</b></p><p style="background:#F6F8F7;padding:10px;border-radius:8px">${P.esc(String(req.text || t.body || '').slice(0, 1500))}</p>${P.btn(site + '/admin.html', 'فتح الدعم الفني')}`));
    }
    return J(400, { error: 'unknown action' });
  } catch (e) { console.error(e); return J(500, { error: e.message }); }
};

// الدفع الإلكتروني: نتحقق من العملية لدى ميسر بالمفتاح السري، ثم نسجّل الدفع ونمدّد الاشتراك
async function payVerify(req) {
  if (!okId(req.invoiceId) || !/^[A-Za-z0-9_-]{8,80}$/.test(String(req.paymentId || ''))) return { ok: false, error: 'bad request' };
  if (!process.env.MOYASAR_SECRET) return { ok: false, error: 'payment not configured' };
  const r = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(req.paymentId)}`, { headers: { Authorization: 'Basic ' + Buffer.from(process.env.MOYASAR_SECRET + ':').toString('base64') } });
  if (!r.ok) return { ok: false, error: 'payment not found' };
  const pay = await r.json();
  const s = await P.sys(); const i = await P.get(s, `invoices/${req.invoiceId}`);
  if (!i) return { ok: false, error: 'invoice not found' };
  if (i.status === 'paid') return { ok: true, already: true, number: i.number };
  const meta = pay.metadata || {};
  if (pay.status !== 'paid') return { ok: false, error: 'not paid', status: pay.status, message: pay.source && pay.source.message };
  if (pay.currency !== 'SAR' || +pay.amount !== Math.round(+i.total * 100) || meta.invoice_id !== req.invoiceId) return { ok: false, error: 'mismatch' };
  const now = new Date().toISOString();
  await P.patch(s, `invoices/${req.invoiceId}`, { status: 'paid', paidAt: now.slice(0, 10), method: 'دفع إلكتروني (ميسر)', ref: pay.id, paidBy: 'online', updatedAt: now });
  try {
    const c = await P.get(s, `companies/${i.cid}`);
    if (c && i.periodTo) await P.patch(s, `companies/${i.cid}`, { status: 'active', paidUntil: i.periodTo > (c.paidUntil || '') ? i.periodTo : c.paidUntil, updatedAt: now });
    await P.notifyStaff(s, ['manager', 'accounts', 'accountant'], { title: 'دفعة إلكترونية ✓', body: `${i.companyName} · ${i.number} · ${i.total} ريال`, url: 'admin.html#invoices', tag: 'pay-' + req.invoiceId });
    if (c) await P.mail(c.ownerEmail, `تم استلام دفعتك ✓ ${i.number}`, `<p>استلمنا دفعتك بمبلغ <b>${P.esc(i.total)} ريال</b> للفاتورة <b dir="ltr">${P.esc(i.number)}</b>. اشتراكك فعّال حتى ${P.esc(i.periodTo)}.</p>`);
  } catch (e) { console.error('after pay', e.message); }
  return { ok: true, number: i.number };
}
