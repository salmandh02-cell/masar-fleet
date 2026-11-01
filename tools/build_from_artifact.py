"""يحوّل نسخة النظام داخل Claude (fleet.html) إلى التطبيق المستقل (index.html).
الاستخدام: python3 tools/build_from_artifact.py ../fleet.html index.html
"""
import sys, re

src = open(sys.argv[1], encoding='utf-8').read()
out = sys.argv[2]

def rep(old, new, count=1, must=True):
    global src
    if old not in src:
        if must: raise SystemExit('pattern not found: ' + old[:80])
        return
    src = src.replace(old, new, count)

head_end = src.index('</style>') + len('</style>')
head, body = src[:head_end], src[head_end:]
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
src = body

# الصور تُخدم من الـ service worker بمسار نسبي
src = src.replace('/_blob/', '_blob/')

# الإقلاع بعد تسجيل الدخول
rep('\nboot();\n</script>', '\nwindow.__appReady.then(boot);\n</script>')

# أخطاء الصلاحيات في Firestore
rep("function handleWriteErr(e){", "function handleWriteErr(e){\n  if(e&&e.code==='permission-denied'){toast('ليست لديك صلاحية لهذا الإجراء');return}")

# الدور يُحدد من قائمة المستخدمين (بالإيميل) أولاً
rep("const r=S.roles.find(x=>x.id===ME.id)||myInvite();return r&&ROLES[r.role]?r.role:'viewer'}",
    "const r=myInvite()||S.roles.find(x=>x.id===ME.id);return r&&ROLES[r.role]?r.role:'viewer'}")
rep("const myDriverId=()=>{const r=ME&&(S.roles.find(x=>x.id===ME.id)||myInvite());",
    "const myDriverId=()=>{const r=ME&&(myInvite()||S.roles.find(x=>x.id===ME.id));")

# صور أصغر لتوفير المساحة
rep("const r=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight))", "const r=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight))")
rep("c.toBlob(res,'image/jpeg',0.82)", "c.toBlob(res,'image/jpeg',0.75)")

# نصوص Claude → نصوص التطبيق
rep("كل سائق يحتاج حساب Claude مشاركاً معه النظام بصلاحية «مساهم»، ثم تحدد نوعه «سائق» وتربطه بملفه من قسم المستخدمين، فيرى سياراته فقط.",
    "أضف السائق من «المستخدمون والصلاحيات» بنوع «سائق» واربطه بملفه، ثم أرسل له رابط التطبيق لينشئ حسابه بنفس الإيميل، فيرى سياراته فقط.")
rep("البريد الإلكتروني (حساب Claude)", "البريد الإلكتروني")
src = re.sub(r'\n\s*<details><summary class="sub" style="cursor:pointer">البحث عن مستخدم داخل مؤسستك.*?</details>', '', src, count=1, flags=re.S)
rep("<span class=\"sub\">تضيف الاسم والإيميل ونوعه، ثم تشارك النظام معه من زر «مشاركة»، وبعد أول دخول تُربط صلاحيته.</span>",
    "<span class=\"sub\">تضيف الاسم والإيميل ونوعه، ثم ترسل له رابط التطبيق لينشئ حسابه بنفس الإيميل. الصلاحية تُطبق تلقائياً.</span>")

# جدول الحسابات: يعرض من دخل فعلاً ونوعه حسب الإيميل
start = src.index('  <div class="panel-h" style="border-top:1px solid var(--line)"><h3>الحسابات التي دخلت النظام</h3>')
end = src.index('  </tbody></table></div></section>`;\n}', start) + len('  </tbody></table></div></section>`;\n}')
src = src[:start] + '''  <div class="panel-h" style="border-top:1px solid var(--line)"><h3>الحسابات التي دخلت النظام</h3><span>${S.seen.length}</span></div><div class="tw"><table><thead><tr><th>المستخدم</th><th>الإيميل</th><th>نوع المستخدم</th><th>السائق المرتبط</th><th>آخر دخول</th></tr></thead><tbody>
    ${[...S.seen].sort((a,b)=>String(b.at).localeCompare(String(a.at))).map(sn=>{const em=String(sn.email||'').toLowerCase();const iv=S.invites.find(x=>String(x.email||'').toLowerCase()===em);const own=em&&em===OWNER_EMAIL;const role=own?'admin':iv?iv.role:null;
      return `<tr><td><b>${esc(sn.name||'—')}</b>${own?' <span class="sub">(مالك النظام)</span>':''}</td><td class="n">${esc(sn.email||'—')}</td><td>${role?`<span class="pill ${role==='admin'?'p-acc':'p-info'}">${esc((ROLES[role]||ROLES.viewer)[0])}</span>`:'<span class="pill p-crit">غير مضاف</span>'}</td><td>${iv&&iv.role==='driver'?esc(dName(iv.driverId)):'—'}</td>
      <td class="n">${(()=>{const d=new Date(sn.at);return isNaN(d)?'—':`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`})()}</td></tr>`}).join('')||'<tr><td colspan="5" class="sub">لم يدخل أحد بعد</td></tr>'}
  </tbody></table></div></section>`;
}''' + src[end:]

# نافذة «طريقة المشاركة»
start = src.index('function shareHelp(iv){')
end = src.index('function inviteForm(id){')
src = src[:start] + '''function shareHelp(iv){
  const link=location.origin+location.pathname;
  modal('إرسال الدعوة إلى '+iv.name,`<div class="mb">
    <p style="margin:0">أرسل لـ <b>${esc(iv.name)}</b> رابط التطبيق، ويُنشئ حسابه بنفس الإيميل <b class="num">${esc(iv.email)}</b>:</p>
    <div class="f"><input id="inv-link" readonly dir="ltr" value="${esc(link)}"></div>
    <ol style="margin:0;padding-inline-start:20px;display:grid;gap:6px"><li>يفتح الرابط ويضغط «مستخدم جديد؟ أنشئ حسابك».</li><li>يكتب اسمه وهذا الإيميل وكلمة مرور.</li><li>يؤكد بريده من الرسالة التي تصله، ثم يدخل مباشرة بصلاحية «${esc((ROLES[iv.role]||ROLES.viewer)[0])}».</li></ol>
    <div class="sub">على الجوال: من قائمة المتصفح «إضافة إلى الشاشة الرئيسية» ليصبح كتطبيق.</div>
  </div>`,`<div class="mf"><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${iv.phone?'966'+String(iv.phone).replace(/^0/,''):''}?text=${encodeURIComponent('السلام عليكم '+iv.name+'، تمت إضافتك في نظام أسطول الشركة. ادخل من الرابط وأنشئ حسابك بإيميلك '+iv.email+': '+link)}">إرسال واتساب</a><button class="btn" data-act="copy-link">نسخ الرابط</button><button class="btn" data-act="close">تم</button></div>`);
}
''' + src[end:]

# سجل التدقيق
rep("company:'الإعدادات'};", "company:'الإعدادات',audit:'سجل التدقيق'};")
rep("['التحليل والإعدادات',[['reports','chart'],['company','gear']]]];", "['التحليل والإعدادات',[['reports','chart'],['company','gear'],['audit','log']]]];")
rep("gear:'<circle", "log:'<path d=\"M6 3h9l4 4v14H6z\"/><path d=\"M9 11h7M9 15h7M9 7h4\"/>',gear:'<circle")
rep("$('#side').innerHTML=NAV.map(([g,items])=>`<div class=\"grp\">${g?`<span>${g}</span>`:''}${items.map(",
    "$('#side').innerHTML=NAV.map(([g,items])=>`<div class=\"grp\">${g?`<span>${g}</span>`:''}${items.filter(([k])=>k!=='audit'||isAdmin()).map(")
rep("let r=route();if(role==='driver'&&r!=='driver'){history.replaceState(null,'','#driver');r='driver'}",
    "let r=route();if(role==='driver'&&r!=='driver'){history.replaceState(null,'','#driver');r='driver'}\n  if(r==='audit'&&!isAdmin()){history.replaceState(null,'','#dashboard');r='dashboard'}")
rep("branches:vBranches,company:vSettings})[r](alerts);", "branches:vBranches,company:vSettings,audit:vAudit})[r](alerts);")
rep("/* ---------- toast & confirm ---------- */", r'''/* ---------- audit log ---------- */
let AUD=null,AUDQ='';
const AUD_COL={vehicles:'السيارات',drivers:'السائقون',handovers:'التسليم والاستلام',maintenance:'الصيانة',fuel:'الوقود',violations:'المخالفات',branches:'الفروع',settings:'الإعدادات',charges:'مطالبات السائقين',accidents:'الحوادث',renewals:'تجديد الوثائق',inspections:'الفحص الأسبوعي',invites:'المستخدمون',roles:'الصلاحيات'};
const AUD_ACT={add:['إضافة','p-ok'],set:['حفظ','p-info'],update:['تعديل','p-warn'],delete:['حذف','p-crit'],import:['استيراد','p-acc']};
async function loadAudit(){try{AUD=await db.recent('audit',500)}catch(e){AUD=[];toast('تعذر تحميل السجل')}if(route()==='audit')render()}
function vAudit(){
  if(AUD===null){loadAudit();return `<div class="head"><div><h2>سجل التدقيق</h2><p>كل إضافة وتعديل وحذف: من قام به ومتى</p></div></div><div class="empty">جارٍ التحميل…</div>`}
  const q=AUDQ.trim();const list=AUD.filter(x=>!q||[x.name,x.email,x.label,AUD_COL[x.col],x.docId].join(' ').includes(q));
  return `<div class="head"><div><h2>سجل التدقيق</h2><p>آخر ${nf.format(AUD.length)} عملية: من قام بها ومتى. لا يمكن تعديل هذا السجل أو حذفه.</p></div><div class="actions"><button class="btn" data-act="aud-reload">تحديث</button></div></div>
  <section class="panel"><div class="panel-b"><input id="audq" class="search" type="search" placeholder="ابحث باسم المستخدم أو اللوحة أو القسم…" value="${esc(AUDQ)}" style="width:100%"></div>
  ${list.length?`<div class="tw"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>السجل</th><th>الحقول المعدلة</th></tr></thead><tbody>
  ${list.map(x=>{const d=new Date(x.at);const a=AUD_ACT[x.action]||[x.action,'p-idle'];return `<tr><td class="n">${isNaN(d)?'—':`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`}</td><td><b>${esc(x.name||'—')}</b><div class="sub num">${esc(x.email||'')}</div></td><td><span class="pill ${a[1]}">${a[0]}</span></td><td>${esc(AUD_COL[x.col]||x.col)}</td><td>${esc(x.label||(x.vid&&vById(x.vid)?plateTxt(vById(x.vid)):'')||(x.col==='vehicles'&&vById(x.docId)?plateTxt(vById(x.docId)):'')||'—')}</td><td class="sub">${x.fields?esc(x.fields.filter(f=>!/At$/.test(f)).join('، ')):''}</td></tr>`}).join('')}
  </tbody></table></div>`:'<div class="empty">لا توجد عمليات مطابقة</div>'}</section>`;
}
document.addEventListener('input',e=>{if(e.target.id==='audq'){AUDQ=e.target.value;const p=e.target.selectionStart;render();const n=$('#audq');if(n){n.focus();n.setSelectionRange(p,p)}}});

/* ---------- toast & confirm ---------- */''')
rep("    case 'backup':exportBackup();break;", """    case 'backup':exportBackup();break;
    case 'aud-reload':AUD=null;render();break;
    case 'logout':confirmBox('تسجيل الخروج من النظام؟','خروج',()=>window.__fbSignOut&&window.__fbSignOut());break;
    case 'copy-link':{const i=$('#inv-link');if(i){i.select();try{navigator.clipboard.writeText(i.value)}catch(err){}toast('تم نسخ الرابط')}}break;
    case 'import-data':if(isAdmin())importForm();break;""")

# حالة المستخدم المضاف حسب دخوله الفعلي
rep("${iv.linkedUid?'<span class=\"pill p-ok\">دخل النظام</span>'", "${S.seen.some(s=>String(s.email||'').toLowerCase()===String(iv.email||'').toLowerCase())?'<span class=\"pill p-ok\">دخل النظام</span>'")
rep("'حذف هذا المستخدم من القائمة؟ إذا كان قد دخل النظام تبقى صلاحيته في جدول الحسابات حتى تلغيها.'", "'حذف هذا المستخدم؟ يفقد صلاحية الدخول للنظام فوراً.'")

# زر الخروج
rep('<span class="rolechip" id="rolechip" hidden></span>', '<span class="rolechip" id="rolechip" hidden></span><button class="logout" data-act="logout" aria-label="تسجيل الخروج" title="تسجيل الخروج"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg></button>')

# استيراد البيانات
rep('<button class="btn" data-act="backup">تنزيل نسخة احتياطية كاملة</button>', '<button class="btn" data-act="backup">تنزيل نسخة احتياطية كاملة</button><button class="btn" data-act="import-data">استيراد بيانات / نسخة احتياطية</button>')
rep("async function exportBackup(){", r'''function importForm(){
  modal('استيراد البيانات',`<div class="mb"><p style="margin:0">اختر ملف النسخة الاحتياطية (JSON) أو ملف الترحيل من النسخة السابقة. السجلات بنفس المعرّف تُستبدل، والباقي يُضاف.</p>
    <div class="f"><input type="file" id="imp-f" accept=".json,application/json"></div><div id="imp-s" class="sub"></div></div>`,
    `<div class="mf"><button class="btn primary" id="imp-go">استيراد</button><button class="btn" data-act="close">إلغاء</button></div>`);
  $('#imp-go').onclick=async()=>{const f=$('#imp-f').files[0];if(!f){$('#imp-s').textContent='اختر الملف أولاً';return}
    let data;try{data=JSON.parse(await f.text())}catch(e){$('#imp-s').textContent='الملف غير صالح';return}
    if(!data.collections){$('#imp-s').textContent='الملف لا يحتوي بيانات النظام';return}
    $('#imp-go').disabled=true;
    try{const n=await db.importAll(data,(d,t)=>{$('#imp-s').textContent=`جارٍ الاستيراد… ${d} من ${t}`});closeModal();toast(`تم استيراد ${nf.format(n)} سجل`)}
    catch(e){$('#imp-go').disabled=false;$('#imp-s').textContent='تعذر الاستيراد: '+(e.code==='permission-denied'?'لا تملك صلاحية':e.message)}};
}
async function exportBackup(){''')

# CSS إضافي
head = head.replace('</style>', '''
.logout{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;cursor:pointer;flex:none}
.logout svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.logout:hover{background:rgba(255,255,255,.12)}
</style>''', 1)

html = f'''<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0E5A44">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="الأسطول">
<script>window.__appReady=new Promise(r=>window.__appReadyResolve=r);</script>
<script type="module">import {{OWNER_EMAIL}} from './config.js';window.OWNER_EMAIL=String(OWNER_EMAIL).toLowerCase();import('./fb.js');</script>
{head}
</head>
<body>
{src}
</body>
</html>
'''
open(out, 'w', encoding='utf-8').write(html)
print('built', out, len(html))
