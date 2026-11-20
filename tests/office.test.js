// اختبار دالة مكتب الموظفين بعميل وهمي (بدون مفتاح ولا شبكة)
const assert = require('assert');
const P = require('../functions/lib/plat-core');
const O = require('../functions/office');
let who = { email: 'salmandh02@gmail.com', verified: true }; P.whoIs = async () => who;
let last = null, reply = { reply: 'تم', drafts: [{ kind: 'ticket', target: 't1', targetName: 'شركة', title: 'رد', body: 'نص الرد' }, { kind: 'post', target: '', targetName: '', title: 'x', body: 'ممنوع للدعم' }] };
O._setClient({ messages: { create: async p => { last = p; return { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { input_tokens: 10, output_tokens: 5 } }; } } });
const call = (body, tok = 'Bearer t') => O.handler({ httpMethod: 'POST', headers: { authorization: tok }, body: JSON.stringify(body) }).then(r => ({ s: r.statusCode, j: JSON.parse(r.body) }));
(async () => {
  let r = await call({ emp: 'support', task: 'brief', data: '{"x":1}' });
  assert.equal(r.s, 200); assert.equal(r.j.drafts.length, 1, 'kind not allowed for this employee is dropped'); assert.equal(r.j.drafts[0].kind, 'ticket');
  assert.ok(last.system[0].text.includes('الدعم')); assert.ok(last.system[1].text.includes('{"x":1}')); assert.equal(last.output_config.format.type, 'json_schema');
  assert.deepEqual(last.output_config.format.schema.properties.drafts.items.properties.kind.enum, ['ticket', 'bug', 'note', 'task']);
  r = await call({ emp: 'coder', task: 'brief', data: '{}' }); assert.equal(r.s, 200); assert.ok(last.system[0].text.includes('طابور البرمجة')); assert.ok(!last.tools, 'coder has no web search');
  r = await call({ emp: 'ideas', message: 'ابحث' }); assert.equal(r.s, 200); assert.equal(last.tools[0].type, 'web_search_20260209', 'ideas researches');
  // إذا رُفضت أداة البحث يعيد الطلب بدونها
  const A = require('@anthropic-ai/sdk'); let calls = 0;
  O._setClient({ messages: { create: async p => { calls++; if (p.tools) throw new A.BadRequestError(400, {}, 'tools not allowed', new Headers()); last = p; return { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: 'تمهيد ' }, { type: 'text', text: JSON.stringify({ reply: 'ok', drafts: [{ kind: 'idea', target: '', targetName: '', title: 'فكرة', body: 'نص' }] }) }], usage: {} }; } } });
  r = await call({ emp: 'ideas', message: 'ابحث' }); assert.equal(r.s, 200); assert.equal(calls, 2); assert.equal(r.j.drafts[0].kind, 'idea', 'last text block parsed');
  O._setClient({ messages: { create: async p => { last = p; return { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { input_tokens: 10, output_tokens: 5 } }; } } });
  r = await call({ emp: 'sales', message: 'مرحبا', history: [{ role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }] });
  assert.equal(r.s, 200); assert.equal(last.messages[0].role, 'user'); assert.equal(last.messages[last.messages.length - 1].content, 'مرحبا');
  reply = { reply: 'ok', drafts: [{ kind: 'coa', target: '', targetName: '', title: 'دليل', body: '1101 | النقدية | الأصول' }, { kind: 'journal', target: '', targetName: '', title: 'قيد', body: 'التاريخ: 2026-11-20' }, { kind: 'idea', target: '', targetName: '', title: 'x', body: 'y' }] };
  r = await call({ emp: 'accountant', message: 'ابني الدليل' }); assert.equal(r.s, 200); assert.deepEqual(r.j.drafts.map(d => d.kind), ['coa', 'journal'], 'accountant drafts chart and journal only');
  assert.ok(last.system[0].text.includes('القيد المزدوج') && last.system[0].text.includes('مدين | دائن'));
  reply = { reply: 'تم', drafts: [{ kind: 'ticket', target: 't1', targetName: 'شركة', title: 'رد', body: 'نص الرد' }] };
  // المدير التنفيذي ومدير العمليات يكلّفون الموظفين
  reply = { reply: 'أولويات', drafts: [{ kind: 'assign', target: 'sales', targetName: 'خالد', title: 'متابعة التجارب', body: 'تابع التجارب' }, { kind: 'ticket', target: 't1', targetName: '', title: 'x', body: 'y' }] };
  r = await call({ emp: 'ceo', task: 'brief', data: '{}' }); assert.equal(r.s, 200); assert.equal(r.j.drafts.length, 1); assert.equal(r.j.drafts[0].kind, 'assign');
  r = await call({ emp: 'coo', task: 'brief', data: '{}' }); assert.equal(r.s, 200); assert.ok(last.system[0].text.includes('سير العمل'));
  // تقييم الخبير لمسودة ولأداء موظف
  reply = { score: 14, verdict: 'يحتاج تعديلاً', strengths: ['واضح'], issues: ['ينقصه الموعد'], improved: 'نسخة أفضل' };
  r = await call({ emp: 'accountant', task: 'review', item: 'قيد', empName: 'نورة' }); assert.equal(r.s, 200); assert.equal(r.j.score, 10, 'score clamped'); assert.equal(r.j.improved, 'نسخة أفضل');
  assert.ok(last.system.includes('SOCPA') && last.system.includes('نورة'), 'accountant expert persona');
  reply = { score: 7, summary: 'جيد', strengths: ['a'], issues: ['b'], recommendations: ['c'] };
  r = await call({ emp: 'support', task: 'review', mode: 'perf', item: 'أعمال' }); assert.equal(r.s, 200); assert.deepEqual(r.j.recommendations, ['c']); assert.equal(last.output_config.format.schema.required.includes('recommendations'), true);
  r = await call({ emp: 'support', task: 'review', item: '' }); assert.equal(r.s, 400, 'empty review rejected');
  r = await call({ emp: 'sales', message: '' }); assert.equal(r.s, 400);
  r = await call({ emp: 'nobody', message: 'x' }); assert.equal(r.s, 400);
  r = await call({ emp: 'sales', message: 'x', persona: { name: 'أبو فهد', extra: 'اذكر الواتساب' } }); assert.ok(last.system[0].text.includes('أبو فهد') && last.system[0].text.includes('اذكر الواتساب'));
  who = { email: 'staff@x.sa', verified: true }; r = await call({ emp: 'sales', message: 'x' }); assert.equal(r.s, 403, 'staff blocked');
  who = { email: 'salmandh02@gmail.com', verified: false }; r = await call({ emp: 'sales', message: 'x' }); assert.equal(r.s, 403, 'unverified blocked');
  r = await call({ emp: 'sales', message: 'x' }, ''); assert.equal(r.s, 401);
  who = { email: 'salmandh02@gmail.com', verified: true }; reply = 'not json'; O._setClient({ messages: { create: async () => ({ stop_reason: 'refusal', content: [], usage: {} }) } });
  r = await call({ emp: 'ops', message: 'x' }); assert.equal(r.s, 422);
  console.log('office tests: 28 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
