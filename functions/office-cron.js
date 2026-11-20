// كل ساعة: يطلب من الدالة الخلفية تنفيذ مهام الموظفين المستحقة الآن (الدوال المجدولة محدودة بـ30 ثانية، والعمل نفسه في الدالة الخلفية)
exports.handler = async () => {
  const site = process.env.URL || process.env.SITE_URL;
  if (!site) return { statusCode: 500, body: 'no site url' };
  try { const r = await fetch(`${site}/.netlify/functions/office-run-background`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); console.log('office-cron', r.status); return { statusCode: 200, body: String(r.status) }; }
  catch (e) { console.error('office-cron', e.message); return { statusCode: 500, body: e.message }; }
};
