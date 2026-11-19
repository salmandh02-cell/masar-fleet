// الفاتورة الضريبية المبسطة: تُستخدم في لوحة المنصة وصفحة الدفع للشركة
// تحتاج qr.js محمّلاً قبلها (window.qrcode)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => s ? String(s).slice(0, 10) : '—';
const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const IST = { unpaid: 'غير مدفوعة', paid: 'مدفوعة', cancelled: 'ملغاة' };
// رمز QR وفق المرحلة الأولى من الفوترة الإلكترونية (زاتكا): البائع، الرقم الضريبي، الوقت، الإجمالي، الضريبة
export function zatcaQR(seller, vatNo, ts, total, vat) {
  const enc = new TextEncoder(); const bytes = [];
  [seller, vatNo, ts, String(total), String(vat)].forEach((v, i) => { const b = enc.encode(v); bytes.push(i + 1, b.length, ...b); });
  let bin = ''; bytes.forEach(x => bin += String.fromCharCode(x));
  const q = window.qrcode(0, 'M'); q.addData(btoa(bin)); q.make(); return q.createDataURL(4, 0);
}
export function invoiceBody(i, s) {
  s = s || {}; const b = i.buyer || {}; const tax = !(i.vatRate === 0 || i.vatRate === '0');
  const qr = tax && s.vatNumber && window.qrcode ? zatcaQR(s.sellerName || '', s.vatNumber, String(i.issuedAt || i.issueDate).replace(/\.\d+Z$/, 'Z'), (+i.total).toFixed(2), (+i.vat).toFixed(2)) : '';
  const stc = i.status === 'paid' ? '#DCFAE6;color:#0E7A4F' : i.status === 'cancelled' ? '#FEE4E2;color:#B42318' : '#FEF0C7;color:#B54708';
  return `<div class="inv"><style>
    .inv{font:14px/1.6 "IBM Plex Sans Arabic",Tahoma,sans-serif;color:#15201B;max-width:820px;margin:0 auto}
    .inv h1{font-size:22px;margin:0;color:#0E5A44}.inv .hd{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #0E5A44;padding-bottom:14px;margin-bottom:16px}
    .inv .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}.inv .box{border:1px solid #D6DDD9;border-radius:10px;padding:10px 14px}.inv .box b{color:#0E5A44}
    .inv table{width:100%;border-collapse:collapse;margin:12px 0}.inv th,.inv td{border:1px solid #D6DDD9;padding:8px 10px;text-align:right}.inv th{background:#F6F8F7}
    .inv .tot td{font-weight:600}.inv .tot tr:last-child td{background:#0E5A44;color:#fff;font-size:16px}.inv .muted{color:#5A6862;font-size:12px}
    .inv .st{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${stc}}
    .inv .tw{overflow-x:auto}@media (max-width:600px){.inv .grid{grid-template-columns:1fr}.inv .hd{flex-direction:column-reverse}}</style>
    <div class="hd"><div><h1>${tax ? 'فاتورة ضريبية مبسطة' : 'فاتورة'}</h1><div class="muted">${tax ? 'Simplified Tax Invoice' : 'Invoice'}</div><div style="margin-top:8px">رقم الفاتورة: <b dir="ltr">${esc(i.number)}</b></div><div>تاريخ الإصدار: ${fmt(i.issueDate)} · الاستحقاق: ${fmt(i.dueDate)}</div><div>الحالة: <span class="st">${esc(IST[i.status] || i.status)}</span>${i.status === 'paid' && i.paidAt ? ` <span class="muted">${fmt(i.paidAt)} · ${esc(i.method || '')}</span>` : ''}</div></div>
      ${qr ? `<img src="${qr}" alt="QR" style="width:130px;height:130px">` : ''}</div>
    <div class="grid"><div class="box"><b>البائع</b><div>${esc(s.sellerName || '—')}</div>${s.sellerNameEn ? `<div dir="ltr" style="text-align:right">${esc(s.sellerNameEn)}</div>` : ''}${tax ? `<div>الرقم الضريبي: <span dir="ltr">${esc(s.vatNumber || '—')}</span></div>` : ''}${s.crNumber ? `<div>السجل التجاري: ${esc(s.crNumber)}</div>` : ''}${s.address ? `<div>${esc(s.address)}</div>` : ''}${s.phone || s.email ? `<div dir="ltr" style="text-align:right">${esc([s.phone, s.email].filter(Boolean).join(' · '))}</div>` : ''}</div>
      <div class="box"><b>العميل</b><div>${esc(b.name || i.companyName)}</div>${i.customerNo ? `<div>رقم العميل: <span dir="ltr">${esc(i.customerNo)}</span></div>` : ''}<div>الرقم الضريبي: <span dir="ltr">${esc(b.vatNumber || '—')}</span></div>${b.crNumber ? `<div>السجل التجاري: ${esc(b.crNumber)}</div>` : ''}${b.address ? `<div>${esc(b.address)}</div>` : ''}</div></div>
    <div class="tw"><table><thead><tr><th>البيان</th><th>الفترة</th><th>الكمية</th><th>سعر الوحدة شهرياً</th><th>الأشهر</th><th>المبلغ</th></tr></thead><tbody>
      <tr><td>${esc(i.desc || 'اشتراك')}</td><td>${fmt(i.periodFrom)} إلى ${fmt(i.periodTo)}</td><td>${esc(i.qty)} سيارة</td><td>${money(i.unitPrice)}</td><td>${esc(i.months || 1)}</td><td>${money((+i.qty) * (+i.unitPrice) * (+i.months || 1))}</td></tr></tbody></table></div>
    <table class="tot" style="width:min(380px,100%);margin-inline-start:auto"><tbody>${+i.discount ? `<tr><td>الخصم</td><td>${money(i.discount)}</td></tr>` : ''}${+i.minApplied ? `<tr><td>تعديل الحد الأدنى للاشتراك</td><td>${money(i.minApplied)}</td></tr>` : ''}${tax ? `<tr><td>الإجمالي قبل الضريبة</td><td>${money(i.subtotal)}</td></tr><tr><td>ضريبة القيمة المضافة ${esc(i.vatRate)}%</td><td>${money(i.vat)}</td></tr><tr><td>الإجمالي شامل الضريبة (ريال)</td><td>${money(i.total)}</td></tr>` : `<tr><td>الإجمالي (ريال)</td><td>${money(i.total)}</td></tr>`}</tbody></table>
    ${s.iban ? `<div class="box" style="margin-top:10px"><b>بيانات التحويل</b><div>${s.bankName ? esc(s.bankName) + ' · ' : ''}<span dir="ltr">${esc(s.iban)}</span></div></div>` : ''}
    ${s.invoiceNote ? `<p class="muted">${esc(s.invoiceNote)}</p>` : ''}</div>`;
}
export function printInvoice(i, s) {
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(i.number)}</title><style>body{margin:0;padding:28px;background:#fff}@media print{body{padding:0}.np{display:none}}@media (max-width:600px){body{padding:14px}}</style></head><body>
    ${invoiceBody(i, s)}<div class="np" style="max-width:820px;margin:20px auto 0"><button onclick="print()" style="font:inherit;padding:8px 18px;background:#0E5A44;color:#fff;border:0;border-radius:8px;cursor:pointer">طباعة / حفظ PDF</button></div></body></html>`);
  w.document.close(); return true;
}
