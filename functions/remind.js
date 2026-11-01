// تذكيرات تلقائية مجدولة: تعمل الساعة 7 و8 و9 صباحاً بتوقيت الرياض
// وفي اليوم المحدد من الشهر الساعة 9 يُرسل كشف الخصومات للموارد البشرية
const { systemLogin, run, dueKinds, list } = require('./lib/remind-core');
const hr = require('./lib/hr-core');
exports.handler = async () => {
  const out = {};
  try {
    const { token } = await systemLogin(false);
    const settings = await list(token, 'settings');
    const cfg = Object.assign({ enabled: false, friday: true, sign: true, digest: true, saturday: true }, settings.find(s => s.id === 'reminders') || {});
    const kinds = dueKinds(cfg);
    if (kinds.length) { const r = await run({ token, kinds }); out.remind = r.res; }
    const h = settings.find(s => s.id === 'hr') || {};
    const now = new Date(Date.now() + 3 * 3600e3);
    if (h.enabled && h.to && now.getUTCHours() === 9 && now.getUTCDate() === (+h.day || 25)) {
      try { out.hr = await hr.send(token); } catch (e) { out.hr = { error: e.message }; }
    }
    console.log('scheduled', JSON.stringify(out));
    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) { console.error('scheduled failed', e.message); return { statusCode: 500, body: e.message }; }
};
