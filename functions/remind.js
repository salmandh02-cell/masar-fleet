// تذكيرات تلقائية مجدولة: تعمل الساعة 7 و8 و9 صباحاً بتوقيت الرياض
// تمر على كل شركة فعّلت التذكيرات، وتقرأ بيانات كل شركة على حدة
// وفي اليوم المحدد من الشهر الساعة 9 يُرسل كشف الخصومات للموارد البشرية
const { systemLogin, run, dueKinds, list, setCompany, companiesFor } = require('./lib/remind-core');
const hr = require('./lib/hr-core');
exports.handler = async () => {
  const out = {};
  try {
    const { token, email } = await systemLogin(false);
    const cos = await companiesFor(token, String(email).toLowerCase());
    for (const c of cos) {
      if (!['trial', 'active'].includes(c.status)) continue;
      const o = out[c.id] = {};
      try {
        setCompany(c.id, c.ownerEmail);
        const settings = await list(token, 'settings');
        const cfg = Object.assign({ enabled: false, friday: true, sign: true, digest: true, saturday: true }, settings.find(s => s.id === 'reminders') || {});
        const kinds = dueKinds(cfg);
        if (kinds.length) { const r = await run({ token, kinds }); o.remind = r.res; }
        const h = settings.find(s => s.id === 'hr') || {};
        const now = new Date(Date.now() + 3 * 3600e3);
        if (h.enabled && h.to && now.getUTCHours() === 9 && now.getUTCDate() === (+h.day || 25)) {
          try { o.hr = await hr.send(token); } catch (e) { o.hr = { error: e.message }; }
        }
      } catch (e) { o.error = e.message; }
    }
    // مهمة المنصة: مرة يومياً الساعة 8 صباحاً بتوقيت الرياض
    if (new Date(Date.now() + 3 * 3600e3).getUTCHours() === 8) {
      try { out._platform = await require('./lib/plat-daily').run(token); } catch (e) { out._platform = { error: e.message }; }
      try { out._stats = await require('./lib/plat-stats').run(token); } catch (e) { out._stats = { error: e.message }; }
    }
    // سجل صحة المهام المجدولة: تعرضه لوحة المنصة في «صحة النظام»
    try {
      const P = require('./lib/plat-core'); const errs = Object.entries(out).filter(([, v]) => v && v.error).map(([k, v]) => `${k}: ${v.error}`).join(' · ').slice(0, 400);
      const h = { remindAt: new Date().toISOString(), remindOk: !errs, remindErr: errs, remindCompanies: Object.keys(out).filter(k => !k.startsWith('_')).length };
      if (out._platform) Object.assign(h, { dailyAt: h.remindAt, dailyOk: !out._platform.error, dailyNote: out._platform.error || `تنبيهات ${out._platform.notices || 0} · إيقاف ${(out._platform.suspended || []).length}` });
      if (out._stats) Object.assign(h, { statsAt: h.remindAt, statsOk: !out._stats.error, overLimit: (out._stats.over || []).length });
      await P.upsert(token, 'platform/health', h);
    } catch (e) { console.warn('health', e.message); }
    console.log('scheduled', JSON.stringify(out));
    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) { console.error('scheduled failed', e.message);
    try { const { token } = await systemLogin(false); await require('./lib/plat-core').upsert(token, 'platform/health', { remindAt: new Date().toISOString(), remindOk: false, remindErr: String(e.message).slice(0, 400) }); } catch (x) {}
    return { statusCode: 500, body: e.message }; }
};
