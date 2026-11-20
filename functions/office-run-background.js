// تشغيل موظفي المكتب تلقائياً على الخادم (دالة خلفية تعمل حتى 15 دقيقة)
// - بلا تذكرة: تنفّذ المهام المجدولة المستحقة في هذه الساعة بتوقيت الرياض (تستدعيها office-cron كل ساعة)
// - اجتماع الصباح يومياً (cfg.meet.hour، افتراضياً 10)، أو فوراً بطلب {meet:true} مرة واحدة في اليوم
// - مع تذكرة: سارة تكتب الرد فور وصولها، وتُرسله تلقائياً فقط لأسئلة الشرح التي جوابها في المراجع المعتمدة
// كل مهمة تُنفَّذ مرة واحدة (officerun)، والنتائج تُكتب في officeinbox وتدمجها لوحة المالك عند فتح المكتب
// لا يُرسل شيء آخر لعميل ولا يُعدَّل أي نظام أو سياسة: كله مسودات بانتظار المالك
const P = require('./lib/plat-core');
const D = require('./lib/office-data');
const O = require('./office');

const ksaNow = () => { const d = new Date(Date.now() + 3 * 3600e3); return { ymd: d.toISOString().slice(0, 10), h: d.getUTCHours(), dow: d.getUTCDay(), dom: d.getUTCDate(), last: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate() }; };
// المهمة مستحقة في هذه الساعة؟ freq: daily | weekly (dow 0=الأحد) | monthly (dom) | monthEnd
function due(t, n) {
  if (!t || t.on === false || +t.hour !== n.h) return false;
  if (t.freq === 'weekly') return +t.dow === n.dow;
  if (t.freq === 'monthly') return +t.dom === n.dom;
  if (t.freq === 'monthEnd') return n.dom === n.last;
  return t.freq === 'daily';
}
const persona = (cfg, emp) => ({ name: ((cfg.persona || {})[emp] || {}).name || O.EMPS[emp].name, extra: ((cfg.persona || {})[emp] || {}).extra || '' });

async function runScheduled(tok, cfg, n) {
  const list = (cfg.sched || []).filter(t => O.EMPS[t.emp] && due(t, n)).slice(0, 10); const out = [];
  if (!list.length) return out;
  const [office, kb] = await Promise.all([P.get(tok, 'platform/office').catch(() => null), P.get(tok, 'platform/officekb').catch(() => null)]);
  for (const t of list) {
    if (!(await P.claim(tok, `officerun/${t.id}-${n.ymd}`, { task: t.id, emp: t.emp, at: new Date().toISOString() }))) { out.push({ id: t.id, skipped: 'done' }); continue; }
    try {
      const data = await D.build(tok, t.emp, office || {});
      const r = await O._work(O.EMPS[t.emp], { task: 'chat', message: `مهمة مجدولة (${t.title}): ${t.prompt}`, data, sop: (cfg.sop || {})[t.emp] || '', refs: D.refsFor(kb, cfg.rcat, t.emp), persona: persona(cfg, t.emp) });
      await P.create(tok, 'officeinbox', { type: 'run', emp: t.emp, task: t.id, title: t.title, prompt: t.prompt, reply: r.reply, drafts: r.drafts, usage: r.usage, cut: !!r.cut, at: new Date().toISOString() });
      out.push({ id: t.id, drafts: r.drafts.length });
    } catch (e) {
      console.error('task', t.id, e.message);
      await P.create(tok, 'officeinbox', { type: 'error', emp: t.emp, task: t.id, title: t.title, text: String(e.message).slice(0, 300), at: new Date().toISOString() }).catch(() => {});
      out.push({ id: t.id, error: e.message });
    }
  }
  return out;
}

// اجتماع الصباح: كل موظف يعرض ما أنجزه وما سيعمل عليه وما يحتاجه، ثم يلخّص ماجد ويكلّف (التكليفات مسودات بانتظار المالك)
const MEET_EMPS = ['coo', 'support', 'sales', 'accountant', 'ideas', 'legal'];
const STANDUP = 'اجتماع الصباح مع ماجد وبقية الفريق. تكلّم بإيجاز في ثلاث نقاط فقط: ما أنجزته منذ أمس، وما ستعمل عليه اليوم، وما تحتاجه من زميل (سمّه) أو من المالك. لا تكتب مسودات.';
async function runMeeting(tok, cfg, n, force) {
  const m = cfg.meet || {};
  if (!force && (m.on === false || +(m.hour ?? 10) !== n.h)) return null;
  if (!(await P.claim(tok, `officerun/meet-${n.ymd}`, { task: 'meet', emp: 'ceo', at: new Date().toISOString() }))) return { skipped: 'done' };
  const [office, kb] = await Promise.all([P.get(tok, 'platform/office').catch(() => null), P.get(tok, 'platform/officekb').catch(() => null)]);
  const emps = (Array.isArray(m.emps) && m.emps.length ? m.emps : MEET_EMPS).filter(k => O.EMPS[k] && k !== 'ceo').slice(0, 8);
  const usage = { in: 0, out: 0 }; const add = u => { usage.in += (u || {}).in || 0; usage.out += (u || {}).out || 0; };
  const ctx = k => ({ sop: (cfg.sop || {})[k] || '', refs: D.refsFor(kb, cfg.rcat, k), persona: persona(cfg, k) });
  const items = await Promise.all(emps.map(async k => {
    try { const r = await O._work(O.EMPS[k], { task: 'chat', message: STANDUP, data: await D.build(tok, k, office || {}), ...ctx(k) }); add(r.usage); return { emp: k, text: String(r.reply || '').slice(0, 1500) }; }
    catch (e) { console.error('meet', k, e.message); return { emp: k, text: 'تعذر حضوره: ' + String(e.message).slice(0, 160), err: true }; }
  }));
  const said = items.map(x => `### ${persona(cfg, x.emp).name}\n${x.text}`).join('\n\n');
  const at = new Date().toISOString();
  try {
    const r = await O._work(O.EMPS.ceo, { task: 'chat', data: await D.build(tok, 'ceo', office || {}), ...ctx('ceo'),
      message: `أدرت اجتماع الصباح، وهذا ما قاله الفريق:\n\n${said}\n\nاكتب للمالك خلاصة الاجتماع: أهم ما أُنجز، وأولويات اليوم، وما يحتاجه كل موظف من زميل أو من المالك. لكل متابعة بين الموظفين اكتب مسودة assign للموظف المعني، وما يحتاج قرار المالك نفسه مسودة task.` });
    add(r.usage);
    await P.create(tok, 'officeinbox', { type: 'meet', emp: 'ceo', title: 'اجتماع الصباح', items, reply: r.reply, drafts: r.drafts, usage, cut: !!r.cut, at });
    return { meet: items.length, drafts: r.drafts.length };
  } catch (e) {
    await P.create(tok, 'officeinbox', { type: 'meet', emp: 'ceo', title: 'اجتماع الصباح', items, reply: 'تعذر على ماجد كتابة الخلاصة: ' + String(e.message).slice(0, 200), drafts: [], usage, at }).catch(() => {});
    return { meet: items.length, error: e.message };
  }
}

async function runTicket(tok, cfg, id, sysEmail) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return { error: 'id' };
  if (cfg.support24 === false) return { skipped: 'off' };
  const t = await P.get(tok, `tickets/${id}`); if (!t || t.status === 'closed') return { skipped: 'closed' };
  const msgs = await D.ticketMsgs(tok, t); if (msgs[msgs.length - 1].من === 'فريق المنصة') return { skipped: 'answered' };
  if (!(await P.claim(tok, `officerun/tk-${id}-${String(t.lastAt || t.createdAt || '').replace(/[^0-9]/g, '').slice(0, 14)}`, { task: 'ticket', emp: 'support', at: new Date().toISOString() }))) return { skipped: 'done' };
  const kb = await P.get(tok, 'platform/officekb').catch(() => null);
  const r = await O._ticketReply({ name: persona(cfg, 'support').name, sop: (cfg.sop || {}).support || '', refs: D.refsFor(kb, cfg.rcat, 'support'), features: (cfg.features || []).join('\n'),
    ticket: JSON.stringify({ الشركة: t.companyName, التصنيف: D.TK_CAT[t.category] || t.category || '', الموضوع: t.subject, الرسائل: msgs }, null, 1) });
  const now = new Date().toISOString();
  // الإرسال التلقائي: أسئلة الشرح فقط، وجوابها من المراجع المعتمدة، وبعد موافقة المالك على هذا الخيار
  const auto = cfg.supportAuto === 'howto' && r.type === 'howto' && r.grounded && r.answer.trim();
  if (auto) {
    const name = `${persona(cfg, 'support').name} (الدعم الآلي)`;
    await P.create(tok, `tickets/${id}/msgs`, { by: sysEmail, byName: name, text: r.answer, at: now, side: 'plat' });
    await P.patch(tok, `tickets/${id}`, { status: 'answered', unreadCo: true, lastAt: now, lastBy: sysEmail });
    await P.notifyCompanyUser(tok, t.cid, t.by, { title: 'رد من الدعم الفني', body: t.subject, url: './#support', tag: 'tk-' + id });
    await P.mail(t.by, `رد على تذكرتك: ${t.subject}`, `<p>وصلك رد من فريق الدعم الفني على تذكرة «${P.esc(t.subject)}».</p><p style="background:#F6F8F7;padding:10px;border-radius:8px">${P.esc(r.answer.slice(0, 1500))}</p>${P.btn(P.SITE() + '/#support', 'فتح التذكرة')}`).catch(() => {});
  }
  const drafts = [];
  if (!auto && r.answer.trim()) drafts.push({ kind: 'ticket', target: id, targetName: t.companyName || '', title: `رد: ${String(t.subject || '').slice(0, 120)}`, body: r.answer });
  if (r.type === 'fault' && r.bug.trim()) drafts.push({ kind: 'bug', target: id, targetName: t.companyName || '', title: `خلل: ${String(t.subject || '').slice(0, 120)}`, body: r.bug });
  const why = { billing: 'تخص الفواتير أو الاشتراك أو الاسترداد', fault: 'خلل في النظام', feature: 'طلب ميزة', other: 'خارج أسئلة الشرح', howto: 'لم يُعثر على الجواب في المراجع المعتمدة' }[r.type];
  await P.create(tok, 'officeinbox', { type: 'ticket', emp: 'support', ticket: id, title: t.subject || '', company: t.companyName || '', kind: r.type, sent: !!auto, eta: r.eta, note: auto ? '' : `${why}. ${r.note}`.trim(), reply: auto ? r.answer : '', drafts, usage: r.usage, at: now });
  return { type: r.type, sent: !!auto, drafts: drafts.length };
}

exports.handler = async (event) => {
  let req = {}; try { req = JSON.parse(event.body || '{}'); } catch (e) {}
  try {
    if (!process.env.ANTHROPIC_API_KEY && !O._hasClient()) return { statusCode: 200, body: 'no key' };
    const { token, email } = await P.sysLogin();
    const cfg = (await P.get(token, 'platform/officeauto').catch(() => null)) || {};
    if (cfg.on === false) return { statusCode: 200, body: 'off' };
    const n = ksaNow();
    const r = req.ticket ? await runTicket(token, cfg, String(req.ticket), email) : req.meet ? await runMeeting(token, cfg, n, true)
      : { tasks: await runScheduled(token, cfg, n), meet: await runMeeting(token, cfg, n, false) };
    console.log('office-run', JSON.stringify(r)); return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) { console.error('office-run failed', e.message); return { statusCode: 500, body: e.message }; }
};
Object.assign(exports, { _due: due, _runTicket: runTicket, _runScheduled: runScheduled, _runMeeting: runMeeting });
