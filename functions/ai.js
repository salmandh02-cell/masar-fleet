// الذكاء الاصطناعي داخل النظام: قراءة الصور لتعبئة النماذج، ومقارنة صور الأضرار، ومساعد يجيب من بيانات الشركة
// لمالك النظام ومدير النظام فقط، بعد تفعيله من إعدادات الشركة، وحسب تفعيل المنصة والباقة
// المفتاح ANTHROPIC_API_KEY يبقى في متغيرات Netlify ولا يصل للمتصفح
const Anthropic = require('@anthropic-ai/sdk');
const P = require('./lib/plat-core');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const MODEL = () => process.env.AI_MODEL || 'claude-haiku-5-5';
let client = null;
const ai = () => client || (client = new (Anthropic.default || Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 55000 }));

// يُستبدل في الاختبارات
exports._setClient = c => { client = c; };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return J(405, { error: 'POST only' });
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return J(400, { error: 'bad json' }); }
  if (!process.env.ANTHROPIC_API_KEY && !client) return J(503, { error: 'no key' });
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
    if (role !== 'admin') return J(403, { error: 'role' });
    const cset = await P.get(tok, `companies/${cid}/settings/ai`).catch(() => null);
    if (!cset || !cset.enabled) return J(403, { error: 'disabled' });
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
    if (req.action === 'read') out = await read(req);
    else if (req.action === 'damage') out = await damage(req);
    else if (req.action === 'ask') out = await ask(req, co);
    else return J(400, { error: 'unknown action' });
    await P.upsert(s, `aiuse/${uid}`, { cid, day, n: (+use.n || 0) + 1, tokensIn: (+use.tokensIn || 0) + (out.usage.in || 0), tokensOut: (+use.tokensOut || 0) + (out.usage.out || 0), [req.action]: (+use[req.action] || 0) + 1, last: new Date().toISOString() }).catch(e => console.warn('aiuse', e.message));
    return J(200, out);
  } catch (e) {
    if (e.refusal) return J(422, { error: 'refusal', message: 'تعذر معالجة هذا الطلب، جرّب صياغة أخرى' });
    if (e.bad) return J(400, { error: 'bad', message: e.message });
    if (e instanceof Anthropic.RateLimitError) return J(429, { error: 'busy', message: 'الخدمة مشغولة، حاول بعد قليل' });
    if (e instanceof Anthropic.AuthenticationError) return J(503, { error: 'ai-key', message: 'مفتاح الذكاء الاصطناعي غير صحيح' });
    if (e instanceof Anthropic.BadRequestError) return J(400, { error: 'ai-bad', message: 'تعذر قراءة الملف أو الطلب' });
    if (e instanceof Anthropic.APIError) { console.error('anthropic', e.status, e.message); return J(502, { error: 'ai', message: 'تعذر الاتصال بخدمة الذكاء الاصطناعي' }); }
    console.error(e); return J(500, { error: e.message });
  }
};

// Claude Haiku 5.5 بدون تفكير: قراءة الصور والمقارنة والإجابة من بيانات جاهزة لا تحتاج تفكيراً مطولاً
async function call(params) {
  const r = await ai().messages.create({ model: MODEL(), thinking: { type: 'disabled' }, ...params });
  if (r.stop_reason === 'refusal') { const e = new Error('refusal'); e.refusal = true; throw e; }
  return r;
}
const textOf = r => r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
const usage = r => ({ in: (r.usage.input_tokens || 0) + (r.usage.cache_read_input_tokens || 0) + (r.usage.cache_creation_input_tokens || 0), out: r.usage.output_tokens || 0 });
const bad = m => { const e = new Error(m); e.bad = true; return e; };
const B64 = /^[A-Za-z0-9+/=]+$/;
const img = d => { if (typeof d !== 'string' || !d || d.length > 3e6 || !B64.test(d)) throw bad('صورة غير صالحة'); return { type: 'image', source: { type: 'base64', media_type: d.startsWith('iVBOR') ? 'image/png' : 'image/jpeg', data: d } }; };
const json = (schema) => ({ effort: 'low', format: { type: 'json_schema', schema } });
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const S = { type: 'string' };

// قراءة صورة مستند وإرجاع قيم الحقول. الحقل غير الموجود يُترك نصاً فارغاً
const KINDS = {
  fuel: { what: 'فاتورة أو إيصال تعبئة وقود', props: { plate: S, date: S, liters: S, amount: S, station: S, odometer: S } },
  odometer: { what: 'صورة عداد السيارة (لوحة العدادات)', props: { odometer: S, fuelEighths: S } },
  violation: { what: 'مخالفة مرورية (رسالة أو إشعار أو لقطة من أبشر)', props: { plate: S, date: S, ref: S, amount: S, kind: S, location: S } },
  istimara: { what: 'استمارة سيارة (رخصة سير)', props: { expiry: S, make: S, model: S, year: S, vin: S, serialNo: S, color: S, plate: S } }
};
async function read(req) {
  const K = KINDS[req.kind]; if (!K) throw bad('نوع غير معروف');
  const schema = obj({ readable: { type: 'boolean' }, ...K.props });
  const r = await call({
    max_tokens: 1500, output_config: json(schema),
    system: `تقرأ صورة ${K.what} من السعودية وتستخرج القيم لنظام إدارة أسطول. اكتب readable=false إذا كانت الصورة غير واضحة أو ليست من هذا النوع.
- التواريخ ميلادية بصيغة YYYY-MM-DD (حوّل الهجري إلى ميلادي).
- الأرقام بالأرقام الإنجليزية دون عملة أو وحدات أو فواصل آلاف.
- اللوحة: الحروف العربية ثم الأرقام، مثل «أ ب ج 1234».
- fuelEighths: مستوى الوقود من 0 إلى 8 (أثمان الخزان).
- اترك الحقل "" إذا لم يظهر في الصورة، ولا تخمّن.`,
    messages: [{ role: 'user', content: [img(req.image), { type: 'text', text: 'استخرج القيم من الصورة.' }] }]
  });
  let f = {}; try { f = JSON.parse(textOf(r)); } catch (e) {}
  const fields = { readable: f.readable !== false };
  for (const k of Object.keys(K.props)) { const v = String(f[k] == null ? '' : f[k]).trim().slice(0, 200); if (v) fields[k] = v; }
  return { fields, usage: usage(r) };
}

// مقارنة صور الاستلام بصور التسليم السابق لكشف الأضرار الجديدة
async function damage(req) {
  const before = (Array.isArray(req.before) ? req.before : []).slice(0, 5).map(img), after = (Array.isArray(req.after) ? req.after : []).slice(0, 5).map(img);
  if (!before.length || !after.length) throw bad('صور ناقصة');
  const schema = obj({ verdict: { type: 'string', enum: ['none', 'possible', 'clear'] }, summary: S, items: { type: 'array', items: obj({ where: S, what: S, severity: S }) }, uncovered: S });
  const r = await call({
    max_tokens: 2000, output_config: json(schema),
    system: `تقارن صور سيارة عند تسليمها لسائق (قبل) بصورها عند استلامها منه (بعد)، لتكشف الأضرار الجديدة فقط: خدوش، صدمات، كسر زجاج أو أنوار، تلف إطارات أو جنوط.
- verdict: clear إذا ظهر ضرر جديد بوضوح، possible إذا احتاج تأكيداً بالمعاينة (زاوية أو إضاءة مختلفة)، none إذا لم يظهر ضرر جديد.
- items: كل ضرر جديد بموضعه (مثل: الباب الأمامي الأيمن) ووصفه وشدته (بسيط، متوسط، كبير).
- لا تذكر الأضرار الموجودة في صور «قبل»، ولا الأوساخ والانعكاسات.
- uncovered: أجزاء السيارة الظاهرة في صور «قبل» وغير المصوّرة في «بعد»، أو "".
- summary جملة أو جملتان بالعربية.`,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'صور التسليم (قبل):' }, ...before, { type: 'text', text: 'صور الاستلام (بعد):' }, ...after] }]
  });
  let rep = {}; try { rep = JSON.parse(textOf(r)); } catch (e) {}
  return { report: { verdict: ['none', 'possible', 'clear'].includes(rep.verdict) ? rep.verdict : 'possible', summary: String(rep.summary || '').slice(0, 600), items: (Array.isArray(rep.items) ? rep.items : []).slice(0, 12).map(i => ({ where: String(i.where || '').slice(0, 80), what: String(i.what || '').slice(0, 200), severity: String(i.severity || '').slice(0, 30) })), uncovered: String(rep.uncovered || '').slice(0, 300) }, usage: usage(r) };
}

// المساعد: يجيب من ملخصات وبيانات الشركة المرسلة من المتصفح (بدون أرقام هويات أو جوالات)
async function ask(req, co) {
  const q = String(req.question || '').trim().slice(0, 1500); if (!q) throw bad('اكتب سؤالك');
  const data = String(req.data || '').slice(0, 400000);
  const hist = (Array.isArray(req.history) ? req.history : []).slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '').slice(0, 4000) })).filter(m => m.content);
  while (hist.length && hist[0].role !== 'user') hist.shift();
  const r = await call({
    max_tokens: 6000, output_config: { effort: 'low' },
    system: [
      { type: 'text', text: `أنت مساعد داخل نظام إدارة أسطول سيارات لشركة «${String(co.name || '').slice(0, 120)}» في السعودية. أجب بالعربية الفصحى المختصرة، مباشرة وبأرقام دقيقة، اعتماداً على بيانات الشركة المرفقة فقط. ابدأ بالملخصات المحسوبة في أول البيانات عند المقارنة بين السيارات أو أنواعها، ولا تُعِد حسابها من السجلات إلا عند الحاجة. إذا لم تكفِ البيانات فقل ذلك بوضوح ولا تخترع. المبالغ بالريال. استخدم قوائم أو جداول Markdown قصيرة عند الحاجة. تاريخ اليوم ${new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)}.` },
      { type: 'text', text: `بيانات الشركة:\n${data}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [...hist, { role: 'user', content: q }]
  });
  return { answer: textOf(r), usage: usage(r) };
}
