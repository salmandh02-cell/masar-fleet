// مكتب الموظفين الأذكياء: موظفون بالذكاء الاصطناعي يعملون لمالك المنصة (دعم، مبيعات، محاسبة، تسويق، عمليات)
// لمالك المنصة فقط. البيانات تُجهَّز في لوحة المالك وتُرسل هنا، والمفتاح يبقى في Netlify ولا يصل للمتصفح
// لا يرسل الموظف شيئاً لأحد: يعيد رداً ومسودات، والمالك يعتمدها من اللوحة
const Anthropic = require('@anthropic-ai/sdk');
const P = require('./lib/plat-core');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const MODEL = () => process.env.OFFICE_MODEL || 'claude-opus-5-5';
let client = null;
const ai = () => client || (client = new (Anthropic.default || Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 55000 }));
exports._setClient = c => { client = c; };

// الموظفون: الدور وما يُنتجه وأنواع المسودات المسموحة
const EMPS = {
  support: { name: 'موظف الدعم الفني', job: `تتولى تذاكر الدعم الواردة من الشركات المشتركة. لكل تذكرة مفتوحة تحتاج رداً اكتب مسودة رد مهذبة ودقيقة بالعربية الفصحى المبسطة تحل المشكلة أو تطلب المعلومة الناقصة، وابدأ بالتذاكر الأقدم والأكثر إلحاحاً. لا تَعِد بميزة غير موجودة ولا بموعد غير مؤكد. إذا كانت المشكلة خللاً في النظام نفسه (وليس خطأ استخدام) فاكتب أيضاً مسودة من نوع bug تصف الخلل للمبرمج: ما يحدث، وأين، وكيف يتكرر، والشركة المتأثرة.`, kinds: ['ticket', 'bug', 'note', 'task'] },
  sales: { name: 'موظف المبيعات', job: `تتابع طلبات التسجيل المعلقة، والشركات في الفترة التجريبية خاصة القريبة من الانتهاء، والشركات المنتهية غير المجددة. اقترح الأولوية واكتب رسائل متابعة قصيرة مقنعة غير مزعجة (واتساب أو بريد) لكل شركة تستحق المتابعة، تذكر قيمة النظام لها بأرقامها إن وُجدت، وتنتهي بخطوة واضحة.`, kinds: ['message', 'note', 'task'] },
  accountant: { name: 'المحاسب', job: `تراجع الفواتير غير المدفوعة والمتأخرة والتحصيل الشهري والمصروفات والرواتب. لخّص الوضع المالي بالأرقام، ونبّه إلى ما يحتاج إجراءً (فاتورة متأخرة، مصروف غير معتاد، تدفق نقدي ضعيف)، واكتب رسائل تذكير بالسداد للشركات المتأخرة بلغة لبقة. لا تخترع أرقاماً.`, kinds: ['message', 'note', 'task', 'report'] },
  marketing: { name: 'موظف التسويق', job: `تكتب محتوى تسويقياً للمنصة: منشورات لينكدإن وإكس، نصوص إعلانات، رسائل حملات، وأفكار محتوى أسبوعية موجهة لشركات الأساطيل في السعودية. استند إلى مزايا النظام وأرقام المنصة العامة فقط، ولا تذكر أسماء العملاء دون إذن.`, kinds: ['post', 'task'] },
  ideas: { name: 'مسؤول التطوير والأفكار', research: true, job: `تطوّر منصة إدارة الأساطيل وسير العمل فيها. تحلّل البيانات المرفقة (أعطال المتصفح، طلبات المزايا وشكاوى العملاء، مؤشرات سير العمل، المزايا الحالية) وتبحث عند الحاجة في الويب عن أفضل الممارسات وما يقدمه المنافسون في السعودية والعالم، ثم تعرض على المالك مقترحات تطوير محددة. كل مقترح مسودة من نوع idea فيها: المشكلة أو الفرصة، الفكرة، الفائدة المتوقعة للعملاء أو للإيراد، الجهد التقريبي (صغير، متوسط، كبير)، والمصدر إن بحثت. لا تكرر ميزة موجودة. المالك يعتمد المقترح فيُحال للمبرمج.`, kinds: ['idea', 'report'] },
  coder: { name: 'المبرمج', job: `أنت مبرمج المنصة. تستلم البنود المعتمدة في «طابور البرمجة» (مقترحات تطوير اعتمدها المالك، وأعطال أحالها الدعم الفني) وأعطال المتصفح المسجلة. البنية: تطبيق ويب PWA بالعربية في ملف index.html كبير مع fb.js (الدخول وطبقة Firebase) وi18n.js، ولوحة المالك admin.html، وقاعدة بيانات Firebase Firestore بقواعد أمان في firestore.rules، ودوال Netlify بـNode.js في functions/. البيانات تحت companies/{cid}/... لكل شركة. لكل بند في الطابور اكتب مسودة من نوع dev هي «طلب تنفيذ» جاهز يُسلَّم لـClaude لينفذه في الكود: الهدف، الملفات المرجّح تعديلها، خطوات التنفيذ، تغيير قواعد الأمان إن لزم، الاختبار ومعيار القبول، والمخاطر. رتّب حسب الأولوية (الأعطال أولاً). أنت لا تملك صلاحية تعديل الكود أو النشر بنفسك، فلا تدّعِ ذلك.`, kinds: ['dev', 'report'] },
  ops: { name: 'محلل العمليات', job: `تراقب استخدام الشركات للنظام وصحة المنصة. حدّد الشركات الخاملة أو المعرضة لعدم التجديد وسبب ذلك، واقترح إجراءً محدداً لكل منها (اتصال، تدريب، تفعيل ميزة)، ونبّه إلى أعطال النظام إن ظهرت في البيانات.`, kinds: ['note', 'task', 'report', 'message'] }
};
const KIND_AR = { ticket: 'رد على تذكرة دعم (target = معرّف التذكرة)', message: 'رسالة لشركة (target = معرّف الشركة)', note: 'ملاحظة تُحفظ في ملف شركة (target = معرّف الشركة)', post: 'منشور أو نص تسويقي (target = اسم المنصة: linkedin أو x أو ads أو email)', task: 'مهمة مقترحة للمالك (target فارغ)', report: 'تقرير (target فارغ)', bug: 'خلل في النظام يُحال للمبرمج (target = معرّف التذكرة إن وجدت)', idea: 'مقترح تطوير يُعرض على المالك (target فارغ)', dev: 'طلب تنفيذ برمجي لبند من الطابور (target = معرّف البند في الطابور)' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return J(405, { error: 'POST only' });
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return J(400, { error: 'bad json' }); }
  if (!process.env.ANTHROPIC_API_KEY && !client) return J(503, { error: 'no key', message: 'أضف ANTHROPIC_API_KEY في متغيرات Netlify لتشغيل المكتب' });
  const auth = event.headers.authorization || event.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return J(401, { error: 'no token' });
  try {
    const me = await P.whoIs(auth.slice(7));
    if (!me || me.email !== P.SUPER() || !me.verified) return J(403, { error: 'owner only' });
    const E = EMPS[req.emp]; if (!E) return J(400, { error: 'emp' });
    return J(200, await work(E, req));
  } catch (e) {
    if (e.refusal) return J(422, { error: 'refusal', message: 'اعتذر الموظف عن هذا الطلب، جرّب صياغة أخرى' });
    if (e.bad) return J(400, { error: 'bad', message: e.message });
    if (e instanceof Anthropic.RateLimitError) return J(429, { error: 'busy', message: 'الخدمة مشغولة، حاول بعد قليل' });
    if (e instanceof Anthropic.AuthenticationError) return J(503, { error: 'ai-key', message: 'مفتاح الذكاء الاصطناعي غير صحيح' });
    if (e instanceof Anthropic.APIConnectionTimeoutError) return J(504, { error: 'timeout', message: 'استغرق الموظف وقتاً أطول من المسموح. جرّب طلباً أصغر.' });
    if (e instanceof Anthropic.APIError) { console.error('anthropic', e.status, e.message); return J(502, { error: 'ai', message: 'تعذر الاتصال بخدمة الذكاء الاصطناعي' }); }
    console.error(e); return J(500, { error: e.message });
  }
};

const S = { type: 'string' };
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const bad = m => { const e = new Error(m); e.bad = true; return e; };

async function work(E, req) {
  const data = String(req.data || '').slice(0, 300000);
  const persona = req.persona || {};
  const extra = String(persona.extra || '').trim().slice(0, 2000);
  const hist = (Array.isArray(req.history) ? req.history : []).slice(-10).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '').slice(0, 4000) })).filter(m => m.content);
  while (hist.length && hist[0].role !== 'user') hist.shift();
  while (hist.length && hist[hist.length - 1].role === 'user') hist.pop();
  const q = req.task === 'brief'
    ? 'جهّز تقرير اليوم: أهم ما في بياناتك الآن مرتباً حسب الأولوية، ثم اكتب المسودات اللازمة لكل ما يحتاج إجراءً اليوم.'
    : String(req.message || '').trim().slice(0, 3000);
  if (!q) throw bad('اكتب طلبك');
  const kinds = E.kinds.map(k => `- ${k}: ${KIND_AR[k]}`).join('\n');
  const schema = obj({ reply: S, drafts: { type: 'array', items: obj({ kind: { type: 'string', enum: E.kinds }, target: S, targetName: S, title: S, body: S }) } });
  const params = {
    model: MODEL(), max_tokens: 8000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system: [
      { type: 'text', text: `أنت «${String(persona.name || E.name).slice(0, 60)}»، موظف بالذكاء الاصطناعي في مكتب منصة «${P.APP()}» لإدارة أساطيل المركبات في السعودية (نظام سحابي باشتراك شهري للشركات). تعمل لصالح مالك المنصة وترفع له عملك.
مهمتك: ${E.job}
${extra ? `تعليمات المالك الخاصة لك: ${extra}\n` : ''}قواعد العمل:
- اعتمد على البيانات المرفقة${E.research ? ' وعلى ما تجده في بحث الويب' : ' فقط'}، وإذا لم تكفِ فقل ذلك في الرد ولا تخترع أسماء أو أرقاماً.
- لا ترسل شيئاً بنفسك: كل ما يُرسل لعميل أو يُنشر يكون مسودة في drafts، والمالك يراجعه ويعتمده.
- reply: ردك على المالك بالعربية الفصحى المختصرة، بصيغة Markdown (عناوين قصيرة وقوائم)، يبدأ بالخلاصة.
- drafts: صفر أو أكثر (حتى 10). أنواعها المسموحة لك:
${kinds}
  targetName اسم الشركة أو الجهة المقروء، وtitle عنوان قصير، وbody النص الجاهز للإرسال كما هو (بدون Markdown في الرسائل والردود).
- المبالغ بالريال السعودي. تاريخ اليوم ${new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)}.` },
      { type: 'text', text: `بيانات المنصة المتاحة لك:\n${data || '(لا توجد بيانات)'}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [...hist, { role: 'user', content: q }]
  };
  // مسؤول التطوير يبحث في الويب (بحد 3 عمليات بحث). إذا رفضت الخدمة الأداة مع الصيغة المنظمة نعيد الطلب بدونها
  let r;
  if (E.research && req.research !== false) {
    const tp = { ...params, tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }] };
    try { r = await ai().messages.create(tp);
      // البحث الطويل قد يتوقف مؤقتاً (pause_turn): نكمل مرة واحدة
      if (r.stop_reason === 'pause_turn') r = await ai().messages.create({ ...tp, messages: [...tp.messages, { role: 'assistant', content: r.content }] }); }
    catch (e) { if (!(e instanceof Anthropic.BadRequestError)) throw e; console.warn('web_search off', e.message); }
  }
  if (!r) r = await ai().messages.create(params);
  if (r.stop_reason === 'refusal') { const e = new Error('refusal'); e.refusal = true; throw e; }
  // الرد المنظّم هو آخر نص؛ ومع البحث قد تسبقه نصوص قصيرة
  const texts = r.content.filter(b => b.type === 'text').map(b => b.text);
  const tryJ = t => { try { const v = JSON.parse(t); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
  const txt = texts.join('').trim();
  const searched = r.content.filter(b => b.type === 'server_tool_use').length;
  const k = txt.lastIndexOf('{"reply"');
  const o = tryJ(txt) || tryJ(String(texts[texts.length - 1] || '').trim()) || (k >= 0 && tryJ(txt.slice(k))) || { reply: txt || 'لم يكتمل الرد، جرّب مرة أخرى.', drafts: [] };
  const drafts = (Array.isArray(o.drafts) ? o.drafts : []).filter(d => E.kinds.includes(d.kind) && String(d.body || '').trim()).slice(0, 10)
    .map(d => ({ kind: d.kind, target: String(d.target || '').slice(0, 80), targetName: String(d.targetName || '').slice(0, 120), title: String(d.title || '').slice(0, 160), body: String(d.body || '').slice(0, 3000) }));
  const u = r.usage || {};
  return { reply: String(o.reply || '').slice(0, 8000), drafts, cut: r.stop_reason === 'max_tokens', model: r.model, searched,
    usage: { in: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), out: u.output_tokens || 0 } };
}
