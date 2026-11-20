// اختبار التشغيل التلقائي للمكتب: الجدول، وسارة على مدار الساعة، وعدم التكرار (بدون شبكة)
const assert = require('assert');
const P = require('../functions/lib/plat-core');
const O = require('../functions/office');
const R = require('../functions/office-run-background');
const db = {}; const made = []; const claimed = new Set(); const patched = []; const mails = [];
P.get = async (tok, path) => db[path] || null;
P.list = async (tok, path) => db[path] || [];
P.create = async (tok, col, data) => { made.push({ col, data }); };
P.patch = async (tok, path, data) => { patched.push({ path, data }); };
P.claim = async (tok, path) => { if (claimed.has(path)) return false; claimed.add(path); return true; };
P.notifyCompanyUser = async () => 1; P.mail = async (...a) => { mails.push(a); return true; };
let out = {}; let last = null;
O._setClient({ messages: { create: async p => { last = p; return { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }], usage: { input_tokens: 5, output_tokens: 3 } }; } } });
(async () => {
  // الاستحقاق: يومي/أسبوعي/شهري/آخر الشهر
  const n = { ymd: '2026-11-30', h: 8, dow: 1, dom: 30, last: 30 };
  assert.ok(R._due({ freq: 'daily', hour: 8 }, n)); assert.ok(!R._due({ freq: 'daily', hour: 9 }, n)); assert.ok(!R._due({ freq: 'daily', hour: 8, on: false }, n));
  assert.ok(R._due({ freq: 'weekly', dow: 1, hour: 8 }, n)); assert.ok(!R._due({ freq: 'weekly', dow: 0, hour: 8 }, n));
  assert.ok(R._due({ freq: 'monthEnd', hour: 8 }, n)); assert.ok(!R._due({ freq: 'monthEnd', hour: 8 }, { ...n, dom: 29 })); assert.ok(R._due({ freq: 'monthly', dom: 30, hour: 8 }, n));
  // المهام المجدولة: تُنفذ مرة واحدة وتُكتب في الصندوق
  db.companies = [{ id: 'c1', name: 'شركة أ', status: 'pending', createdAt: '2026-11-20' }];
  const cfg = { sched: [{ id: 'sal-reg', emp: 'sales', title: 'طلبات التسجيل', freq: 'daily', hour: 8, prompt: 'تابع الطلبات' }, { id: 'x', emp: 'nobody', freq: 'daily', hour: 8 }], sop: { sales: 'دليل خالد' }, persona: { sales: { name: 'خالد (المبيعات)' } } };
  out = { reply: 'تم', drafts: [{ kind: 'message', target: 'c1', targetName: 'شركة أ', title: 'نواقص', body: 'نرجو إرفاق السجل' }] };
  let r = await R._runScheduled('t', cfg, n); assert.equal(r.length, 1); assert.equal(r[0].drafts, 1);
  assert.ok(last.system[0].text.includes('خالد (المبيعات)') && last.system[0].text.includes('دليل خالد') && last.messages[0].content.includes('مهمة مجدولة'));
  assert.ok(last.system[1].text.includes('شركة أ'), 'server data builder');
  assert.equal(made[0].col, 'officeinbox'); assert.equal(made[0].data.type, 'run'); assert.equal(made[0].data.drafts.length, 1);
  r = await R._runScheduled('t', cfg, n); assert.equal(r[0].skipped, 'done', 'no double run same day');
  // سارة: سؤال شرح من المراجع يُرسل تلقائياً
  db['tickets/t1'] = { id: 't1', cid: 'c1', by: 'a@b.c', companyName: 'شركة أ', subject: 'كيف أضيف سيارة؟', body: 'كيف', status: 'open', category: 'training', lastAt: '2026-11-21T01:00:00Z' };
  out = { type: 'howto', grounded: true, answer: 'من قائمة السيارات اضغط إضافة', eta: '', note: '', bug: '' };
  made.length = 0; r = await R._runTicket('t', { supportAuto: 'howto', sop: { support: 'دليل سارة' } }, 't1', 'sys@x');
  assert.equal(r.sent, true); assert.ok(made.some(m => m.col === 'tickets/t1/msgs' && m.data.side === 'plat')); assert.equal(patched[0].data.status, 'answered'); assert.equal(mails.length, 1);
  assert.equal(made.find(m => m.col === 'officeinbox').data.sent, true);
  r = await R._runTicket('t', { supportAuto: 'howto' }, 't1', 'sys@x'); assert.equal(r.skipped, 'done', 'same ticket state handled once');
  // الفواتير والاسترداد: مسودة فقط
  db['tickets/t2'] = { ...db['tickets/t1'], id: 't2', subject: 'أريد استرداد', lastAt: '2026-11-21T02:00:00Z' };
  out = { type: 'billing', grounded: true, answer: 'سنراجع طلبك', eta: 'يوم عمل', note: 'يحتاج قرارك', bug: '' };
  made.length = 0; patched.length = 0; r = await R._runTicket('t', { supportAuto: 'howto' }, 't2', 'sys@x');
  assert.equal(r.sent, false); assert.equal(patched.length, 0); const ib = made.find(m => m.col === 'officeinbox').data; assert.equal(ib.drafts[0].kind, 'ticket'); assert.ok(ib.note.includes('الفواتير'));
  // شرح بلا مرجع، أو الإرسال التلقائي غير مفعّل: مسودة فقط
  db['tickets/t3'] = { ...db['tickets/t1'], id: 't3', lastAt: '2026-11-21T03:00:00Z' }; out = { type: 'howto', grounded: false, answer: 'ربما', eta: '', note: '', bug: '' };
  made.length = 0; r = await R._runTicket('t', { supportAuto: 'howto' }, 't3', 'sys@x'); assert.equal(r.sent, false);
  db['tickets/t4'] = { ...db['tickets/t1'], id: 't4', lastAt: '2026-11-21T04:00:00Z' }; out = { type: 'howto', grounded: true, answer: 'جواب', eta: '', note: '', bug: '' };
  r = await R._runTicket('t', { supportAuto: 'off' }, 't4', 'sys@x'); assert.equal(r.sent, false);
  // عطل: مسودة رد ومسودة خلل للمبرمج
  db['tickets/t5'] = { ...db['tickets/t1'], id: 't5', lastAt: '2026-11-21T05:00:00Z' }; out = { type: 'fault', grounded: false, answer: 'نعمل عليه', eta: '4 ساعات', note: '', bug: 'الصفحة لا تفتح' };
  made.length = 0; r = await R._runTicket('t', { supportAuto: 'howto' }, 't5', 'sys@x'); assert.deepEqual(made.find(m => m.col === 'officeinbox').data.drafts.map(d => d.kind), ['ticket', 'bug']);
  // مغلقة أو آخر رسالة من المنصة أو 24 ساعة موقوفة: لا شيء
  db['tickets/t6'] = { ...db['tickets/t1'], id: 't6', status: 'closed' }; r = await R._runTicket('t', {}, 't6', 's'); assert.equal(r.skipped, 'closed');
  db['tickets/t7/msgs'] = [{ side: 'plat', text: 'رددنا', at: '2026-11-21' }]; db['tickets/t7'] = { ...db['tickets/t1'], id: 't7' }; r = await R._runTicket('t', {}, 't7', 's'); assert.equal(r.skipped, 'answered');
  r = await R._runTicket('t', { support24: false }, 't1', 's'); assert.equal(r.skipped, 'off');
  r = await R._runTicket('t', {}, '../x', 's'); assert.equal(r.error, 'id');
  assert.ok(last.system[0].text.includes('لا تستشهد بمواد الأنظمة'));
  console.log('office auto tests: passed');
})().catch(e => { console.error(e); process.exit(1); });
