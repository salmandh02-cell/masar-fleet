// الذكاء الاصطناعي داخل النظام: قراءة المستندات المصوّرة لتعبئة النماذج، ومساعد يجيب من بيانات الشركة
// المفتاح ANTHROPIC_API_KEY يبقى في متغيرات Netlify ولا يصل للمتصفح
const Anthropic = require('@anthropic-ai/sdk');
const P = require('./lib/plat-core');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const MODEL = () => process.env.AI_MODEL || 'claude-opus-5-5';
const IMG = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
let client = null;
const ai = () => client || (client = new (Anthropic.default || Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 55000 }));

// يُستبدل في الاختبارات
exports._setClient = c => { client = c; };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return J(405, { error: 'POST only' });
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return J(400, { error: 'bad json' }); }
  if (!process.env.ANTHROPIC_API_KEY && !client) return J(503, { error: 'ai-off', message: 'الذكاء الاصطناعي غير مفعّل بعد' });
  const auth = event.headers.authorization || event.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return J(401, { error: 'no token' });
  const tok = auth.slice(7);
  try {
    const me = await P.whoIs(tok); if (!me || !me.email) return J(401, { error: 'bad token' });
    // الشركة وصلاحية المستخدم: تُقرأ بصلاحيته هو، فلا يصل أحد لغير شركته
    const mem = await P.get(tok, `members/${encodeURIComponent(me.email)}`).catch(() => null);
    if (!mem || !mem.companyId) return J(403, { error: 'no company' });
    const cid = mem.companyId; const co = await P.get(tok, `companies/${cid}`);
    if (!co || !['trial', 'active'].includes(co.status)) return J(403, { error: 'inactive', message: 'اشتراك الشركة غير فعّال' });
    const owner = String(co.ownerEmail || '').toLowerCase() === me.email;
    let role = 'admin';
    if (!owner) { const acc = await P.get(tok, `companies/${cid}/access/${encodeURIComponent(me.email)}`).catch(() => null); if (!acc) return J(403, { error: 'no access' }); role = acc.role || ''; }
    if (role === 'driver') return J(403, { error: 'role', message: 'هذه الميزة لفريق الإدارة' });
    // تفعيل المنصة والباقة والحد اليومي
    const s = await P.sys(); const set = (await P.get(s, 'platform/settings').catch(() => null)) || {};
    if (set.aiEnabled !== 'on' && set.aiEnabled !== true) return J(403, { error: 'ai-off', message: 'الذكاء الاصطناعي غير مفعّل في المنصة' });
    const plan = (set.plans || []).find(p => p.id === co.planId);
    if (co.status === 'active' && plan && !plan.ai) return J(403, { error: 'plan', message: 'الذكاء الاصطناعي غير متاح في باقتك الحالية. اطلب ترقية الباقة.' });
    const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); const uid = `${cid}_${day}`;
    const use = (await P.get(s, `aiuse/${uid}`).catch(() => null)) || {};
    const limit = +set.aiDaily || 100;
    if ((+use.n || 0) >= limit) return J(429, { error: 'quota', message: `وصلت شركتك للحد اليومي (${limit} طلب). يتجدد غداً.` });

    let out;
    if (req.action === 'scan') out = await scan(req);
    else if (req.action === 'ask') out = await ask(req, co);
    else return J(400, { error: 'unknown action' });
    await P.upsert(s, `aiuse/${uid}`, { cid, day, n: (+use.n || 0) + 1, tokensIn: (+use.tokensIn || 0) + (out.usage.in || 0), tokensOut: (+use.tokensOut || 0) + (out.usage.out || 0), [req.action]: (+use[req.action] || 0) + 1, last: new Date().toISOString() }).catch(e => console.warn('aiuse', e.message));
    return J(200, out);
  } catch (e) {
    if (e.refusal) return J(200, { ok: false, message: 'تعذر معالجة هذا الطلب، جرّب صياغة أخرى' });
    if (e instanceof Anthropic.RateLimitError) return J(429, { error: 'busy', message: 'الخدمة مشغولة، حاول بعد قليل' });
    if (e instanceof Anthropic.AuthenticationError) return J(503, { error: 'ai-key', message: 'مفتاح الذكاء الاصطناعي غير صحيح' });
    if (e instanceof Anthropic.BadRequestError) return J(400, { error: 'ai-bad', message: 'تعذر قراءة الملف أو الطلب' });
    if (e instanceof Anthropic.APIError) { console.error('anthropic', e.status, e.message); return J(502, { error: 'ai', message: 'تعذر الاتصال بخدمة الذكاء الاصطناعي' }); }
    console.error(e); return J(500, { error: e.message });
  }
};

async function call(params) {
  const r = await ai().beta.messages.create({ model: MODEL(), betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', ...params });
  if (r.stop_reason === 'refusal') { const e = new Error('refusal'); e.refusal = true; throw e; }
  return r;
}
const textOf = r => r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
const usage = r => ({ in: (r.usage.input_tokens || 0) + (r.usage.cache_read_input_tokens || 0) + (r.usage.cache_creation_input_tokens || 0), out: r.usage.output_tokens || 0 });

// قراءة مستند: نرسل الصورة وقائمة حقول النموذج الظاهر، ونطلب قيمها فقط
async function scan(req) {
  const f = req.file || {}; const fields = (Array.isArray(req.fields) ? req.fields : []).filter(x => x && /^[A-Za-z_][\w-]{0,40}$/.test(x.name)).slice(0, 60);
  if (!fields.length) return { ok: false, message: 'لا توجد حقول لتعبئتها', usage: {} };
  if (!(IMG.has(f.type) || f.type === 'application/pdf') || typeof f.data !== 'string' || f.data.length > 7e6 || !/^[A-Za-z0-9+/=]+$/.test(f.data)) return { ok: false, message: 'الملف غير مدعوم. صوّر المستند (JPG أو PNG) أو ارفع PDF', usage: {} };
  const desc = fields.map(x => `- ${x.name}: ${String(x.label || '').slice(0, 80)}${x.type === 'date' ? ' (تاريخ ميلادي YYYY-MM-DD)' : x.type === 'datetime-local' ? ' (YYYY-MM-DDTHH:MM)' : x.type === 'number' ? ' (رقم فقط)' : ''}${x.options && x.options.length ? ` (اختر حرفياً من: ${x.options.slice(0, 40).map(o => o.text).join(' | ')})` : ''}`).join('\n');
  const schema = { type: 'object', properties: Object.fromEntries(fields.map(x => [x.name, { type: 'string' }])), required: fields.map(x => x.name), additionalProperties: false };
  const block = f.type === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } } : { type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } };
  const r = await call({
    max_tokens: 4000, output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system: 'أنت تقرأ مستندات سعودية (استمارة مركبة، رخصة قيادة، هوية/إقامة، وثيقة تأمين، مخالفة مرورية، فاتورة وقود أو صيانة، تقرير نجم) وتستخرج منها قيم حقول نموذج في نظام إدارة أسطول. اكتب القيمة كما في المستند. حوّل التواريخ الهجرية إلى ميلادية. أرقام اللوحة بالأرقام الإنجليزية وحروفها بالعربية مفصولة بمسافات. اترك الحقل نصاً فارغاً "" إذا لم تجده في المستند ولا تخمّن.',
    messages: [{ role: 'user', content: [block, { type: 'text', text: `النموذج: ${String(req.form || '').slice(0, 80)}\nالحقول المطلوبة:\n${desc}` }] }]
  });
  let values = {}; try { values = JSON.parse(textOf(r)); } catch (e) { values = {}; }
  values = Object.fromEntries(Object.entries(values).filter(([k, v]) => fields.some(x => x.name === k) && typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 500)]));
  return { ok: true, values, usage: usage(r) };
}

// المساعد: يجيب من بيانات الشركة المرسلة من المتصفح (المستخدم يرسل ما يحق له رؤيته فقط)
async function ask(req, co) {
  const q = String(req.question || '').trim().slice(0, 1500); if (!q) return { ok: false, message: 'اكتب سؤالك', usage: {} };
  const data = String(req.data || '').slice(0, 400000);
  const hist = (Array.isArray(req.history) ? req.history : []).slice(-6).flatMap(h => [{ role: 'user', content: String(h.q || '').slice(0, 1500) }, { role: 'assistant', content: String(h.a || '').slice(0, 4000) }]).filter(m => m.content);
  const r = await call({
    max_tokens: 8000, output_config: { effort: 'low' },
    system: [
      { type: 'text', text: `أنت مساعد داخل نظام إدارة أسطول سيارات لشركة «${String(co.name || '').slice(0, 120)}» في السعودية. أجب بالعربية الفصحى المختصرة، مباشرة وبأرقام دقيقة، اعتماداً على بيانات الشركة المرفقة فقط. إذا لم تكفِ البيانات للإجابة فقل ذلك بوضوح ولا تخترع. المبالغ بالريال. استخدم قوائم أو جداول Markdown قصيرة عند الحاجة. تاريخ اليوم ${new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)}.` },
      { type: 'text', text: `بيانات الشركة (JSON، كل سطر سجل):\n${data}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [...hist, { role: 'user', content: q }]
  });
  return { ok: true, answer: textOf(r), usage: usage(r) };
}
