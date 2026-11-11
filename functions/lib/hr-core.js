// كشف الخصومات للموارد البشرية: يُبنى من المخالفات غير المسددة والمطالبات المعلقة على السائقين، ويُرسل بالبريد
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const { list } = require('./remind-core');

const CHKINDS = { damage: 'أضرار على السيارة', accident: 'حادث', fuel: 'وقود غير مبرر', custody: 'فقدان أو تلف عهدة', other: 'أخرى' };
const plateTxt = v => v ? `${v.plateLetters || ''} ${v.plateNumbers || ''}`.trim() : '—';
const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');

async function build(token) {
  const [drivers, vehicles, violations, charges, settings] = await Promise.all(['drivers', 'vehicles', 'violations', 'charges', 'settings'].map(c => list(token, c)));
  const vById = id => vehicles.find(v => v.id === id);
  const company = (settings.find(s => s.id === 'main') || {}).companyName || '';
  const hr = settings.find(s => s.id === 'hr') || {};
  const items = [];
  for (const x of violations) if (x.driverId && x.status === 'unpaid') items.push({ d: x.driverId, date: String(x.date || '').slice(0, 10), what: 'مخالفة: ' + (x.kind || ''), ref: x.ref || '', plate: plateTxt(vById(x.vehicleId)), amount: +x.amount || 0 });
  for (const x of charges) if (x.driverId && x.status === 'pending') items.push({ d: x.driverId, date: String(x.date || '').slice(0, 10), what: (CHKINDS[x.kind] || x.kind || 'مطالبة') + (x.notes ? ' – ' + x.notes : ''), ref: '', plate: plateTxt(vById(x.vehicleId)), amount: +x.amount || 0 });
  const per = {};
  for (const it of items) { (per[it.d] = per[it.d] || []).push(it); }
  const rows = Object.entries(per).map(([id, its]) => { const d = drivers.find(x => x.id === id) || {}; return { name: d.name || '—', empNo: d.empNo || '', dept: d.dept || '', idNo: d.idNo || '', count: its.length, total: its.reduce((t, i) => t + i.amount, 0), its }; })
    .sort((a, b) => b.total - a.total);
  return { company, hr, rows, total: rows.reduce((t, r) => t + r.total, 0) };
}

function xlsxBuffer(st, period) {
  const wb = XLSX.utils.book_new();
  const s1 = [[`كشف الخصومات المستحقة على السائقين${st.company ? ' – ' + st.company : ''}`], [`حتى تاريخ ${period}`], [],
    ['م', 'اسم السائق', 'الرقم الوظيفي', 'القسم', 'رقم الهوية', 'عدد البنود', 'المبلغ المستحق (ر.س)'],
    ...st.rows.map((r, i) => [i + 1, r.name, r.empNo, r.dept, r.idNo, r.count, r.total]), [], ['', 'الإجمالي', '', '', '', st.rows.reduce((t, r) => t + r.count, 0), st.total]];
  const ws1 = XLSX.utils.aoa_to_sheet(s1); ws1['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 13 }, { wch: 16 }, { wch: 14 }, { wch: 11 }, { wch: 18 }]; ws1['!views'] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws1, 'الملخص');
  const s2 = [['اسم السائق', 'الرقم الوظيفي', 'التاريخ', 'البند', 'السيارة', 'رقم المخالفة', 'المبلغ (ر.س)']];
  for (const r of st.rows) for (const i of r.its) s2.push([r.name, r.empNo, i.date, i.what, i.plate, i.ref, i.amount]);
  const ws2 = XLSX.utils.aoa_to_sheet(s2); ws2['!cols'] = [{ wch: 24 }, { wch: 13 }, { wch: 12 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 13 }]; ws2['!views'] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws2, 'التفاصيل');
  wb.Workbook = { Views: [{ RTL: true }] };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function htmlBody(st, period) {
  const tr = st.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.empNo}</td><td>${r.dept}</td><td style="text-align:center">${r.count}</td><td style="text-align:left"><b>${money(r.total)}</b></td></tr>`).join('');
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;color:#15201B;font-size:14px;line-height:1.7">
  <p>السلام عليكم ورحمة الله،</p>
  <p>مرفق كشف الخصومات المستحقة على السائقين حتى تاريخ <b>${period}</b>${st.company ? ' – ' + st.company : ''}، لاعتماد خصمها من الرواتب.</p>
  ${st.rows.length ? `<table cellpadding="8" style="border-collapse:collapse;border:1px solid #D6DDD9;min-width:520px">
  <thead><tr style="background:#0E5A44;color:#fff"><th>م</th><th>السائق</th><th>الرقم الوظيفي</th><th>القسم</th><th>البنود</th><th>المبلغ (ر.س)</th></tr></thead>
  <tbody>${tr}</tbody><tfoot><tr style="background:#F1F6F3"><td colspan="5"><b>الإجمالي</b></td><td style="text-align:left"><b>${money(st.total)}</b></td></tr></tfoot></table>` : '<p><b>لا توجد خصومات مستحقة هذا الشهر.</b></p>'}
  <p>التفاصيل بنداً بنداً في ملف Excel المرفق.</p>
  <p style="color:#5A6862;font-size:12px">رسالة تلقائية من منصة مسار</p></div>`;
}

async function send(token, opts = {}) {
  const st = await build(token);
  const to = opts.to || st.hr.to;
  if (!to) throw new Error('no HR email');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP not configured');
  const period = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const tx = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: +(process.env.SMTP_PORT || 465), secure: (process.env.SMTP_PORT || '465') === '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await tx.sendMail({
    from: `"${st.company || 'مسار'}" <${process.env.SMTP_USER}>`, to, cc: opts.cc || st.hr.cc || undefined,
    subject: `كشف خصومات السائقين – ${period}`, html: htmlBody(st, period),
    attachments: [{ filename: `كشف الخصومات ${period}.xlsx`, content: xlsxBuffer(st, period) }]
  });
  return { sent: true, drivers: st.rows.length, total: st.total, to };
}

module.exports = { build, send, xlsxBuffer };
