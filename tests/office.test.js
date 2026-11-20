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
  assert.deepEqual(last.output_config.format.schema.properties.drafts.items.properties.kind.enum, ['ticket', 'note', 'task']);
  r = await call({ emp: 'sales', message: 'مرحبا', history: [{ role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }] });
  assert.equal(r.s, 200); assert.equal(last.messages[0].role, 'user'); assert.equal(last.messages[last.messages.length - 1].content, 'مرحبا');
  r = await call({ emp: 'sales', message: '' }); assert.equal(r.s, 400);
  r = await call({ emp: 'nobody', message: 'x' }); assert.equal(r.s, 400);
  r = await call({ emp: 'sales', message: 'x', persona: { name: 'أبو فهد', extra: 'اذكر الواتساب' } }); assert.ok(last.system[0].text.includes('أبو فهد') && last.system[0].text.includes('اذكر الواتساب'));
  who = { email: 'staff@x.sa', verified: true }; r = await call({ emp: 'sales', message: 'x' }); assert.equal(r.s, 403, 'staff blocked');
  who = { email: 'salmandh02@gmail.com', verified: false }; r = await call({ emp: 'sales', message: 'x' }); assert.equal(r.s, 403, 'unverified blocked');
  r = await call({ emp: 'sales', message: 'x' }, ''); assert.equal(r.s, 401);
  who = { email: 'salmandh02@gmail.com', verified: true }; reply = 'not json'; O._setClient({ messages: { create: async () => ({ stop_reason: 'refusal', content: [], usage: {} }) } });
  r = await call({ emp: 'ops', message: 'x' }); assert.equal(r.s, 422);
  console.log('office tests: 12 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
