// حساب العرض التجريبي: شركة وهمية ببيانات أسطول واقعية لعرض النظام على العملاء
// الاستخدام:
//   1) DEMO_PASS=... node tools/demo-seed.mjs signup   ← ينشئ الحساب وطلب الشركة (بانتظار اعتماد المالك)
//   2) DEMO_PASS=... node tools/demo-seed.mjs seed     ← بعد الاعتماد: يملأ البيانات
// للمحاكي: FIRESTORE_EMULATOR_HOST و FIREBASE_AUTH_EMULATOR_HOST و FB_PROJECT و FB_API_KEY
import { FIREBASE_CONFIG } from '../config.js';
const PRJ = process.env.FB_PROJECT || FIREBASE_CONFIG.projectId, KEY = process.env.FB_API_KEY || FIREBASE_CONFIG.apiKey;
const EMAIL = process.env.DEMO_EMAIL || 'demo@m.manhalfleet.app', PASS = process.env.DEMO_PASS, CID = process.env.DEMO_CID || 'demo-fleet';
if (!PASS || PASS.length < 8) throw new Error('DEMO_PASS (8+) required');
const FSH = process.env.FIRESTORE_EMULATOR_HOST ? `http://${process.env.FIRESTORE_EMULATOR_HOST}` : 'https://firestore.googleapis.com';
const IDT = process.env.FIREBASE_AUTH_EMULATOR_HOST ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts` : 'https://identitytoolkit.googleapis.com/v1/accounts';
const DOC = `projects/${PRJ}/databases/(default)/documents`;
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { stringValue: String(v) };
const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
async function idt(op, body) { const r = await fetch(`${IDT}:${op}?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(op + ' ' + JSON.stringify(j.error && j.error.message)); return j; }
async function commit(tok, writes) { for (let i = 0; i < writes.length; i += 400) { const r = await fetch(`${FSH}/v1/${DOC}:commit`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) }); if (!r.ok) throw new Error('commit ' + r.status + ' ' + (await r.text()).slice(0, 300)); } }
const W = (path, data, mustNotExist) => ({ update: { name: `${DOC}/${path}`, fields: fields(data) }, ...(mustNotExist ? { currentDocument: { exists: false } } : {}) });

// ---------- مولد بيانات ثابت (نفس النتيجة كل مرة) ----------
let seed = 20261106; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = a => a[Math.floor(rnd() * a.length)];
const day = (offset) => { const d = new Date(Date.now() + 3 * 3600e3); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
const dt = (offset, h = 9) => `${day(offset)}T${String(h).padStart(2, '0')}:${String(ri(0, 59)).padStart(2, '0')}`;
const now = new Date().toISOString();

function build() {
  const out = {};
  const branches = [['br-ruh', 'المقر الرئيسي', 'الرياض', 'عبدالله الشهري'], ['br-jed', 'فرع جدة', 'جدة', 'ماجد الغامدي'], ['br-dmm', 'فرع الدمام', 'الدمام', 'فهد الدوسري']]
    .map(([id, name, city, manager]) => ({ id, name, city, manager, phone: '05' + ri(10000000, 99999999), demo: false, updatedAt: now }));
  const first = ['محمد', 'أحمد', 'خالد', 'عبدالرحمن', 'سعد', 'فيصل', 'عمر', 'يوسف', 'ناصر', 'سلطان', 'تركي', 'بندر', 'راشد', 'سامي', 'إبراهيم', 'حسن', 'وليد', 'ماجد'];
  const last = ['القحطاني', 'العتيبي', 'الشمري', 'الحربي', 'الزهراني', 'المطيري', 'الدوسري', 'الغامدي', 'العنزي', 'السبيعي', 'الشهري', 'البقمي', 'الرشيدي', 'اليامي', 'الجهني', 'العمري', 'السهلي', 'الخالدي'];
  const drivers = first.map((f, i) => ({ id: 'd' + String(i + 1).padStart(2, '0'), name: `${f} ${last[i]}`, empNo: String(1040 + i), dept: pick(['التوزيع', 'المبيعات', 'المشاريع', 'الخدمات اللوجستية']), phone: '05' + ri(30000000, 99999999),
    idNo: (i % 4 ? '1' : '2') + ri(100000000, 999999999), licenseNo: String(ri(1000000000, 1999999999)), licenseExp: i === 3 ? day(12) : i === 8 ? day(-5) : day(ri(90, 1400)), active: true, hasDrvCard: i % 3 === 0, drvCardNo: i % 3 === 0 ? String(ri(100000, 999999)) : '', drvCardExp: i % 3 === 0 ? day(ri(60, 700)) : '', demo: false, updatedAt: now }));
  const models = [['تويوتا', 'هايلكس', 'بيك أب', 80], ['تويوتا', 'هايلكس', 'بيك أب', 80], ['هيونداي', 'أكسنت', 'سيدان', 45], ['تويوتا', 'كامري', 'سيدان', 60], ['نيسان', 'باترول', 'جيب / SUV', 100], ['إيسوزو', 'NPR', 'شاحنة', 100], ['هيونداي', 'H1', 'فان', 75], ['فورد', 'رينجر', 'بيك أب', 80], ['تويوتا', 'هايس', 'باص', 70], ['شيفروليه', 'تاهو', 'جيب / SUV', 98], ['هيونداي', 'إلنترا', 'سيدان', 50]];
  const L = 'ا ب ح د ر س ص ط ع ق ك ل م ن ه و ى'.split(' '); const colors = ['أبيض', 'أبيض', 'فضي', 'رمادي', 'أسود', 'أبيض لؤلؤي'];
  const vehicles = []; let dIdx = 0;
  for (let i = 0; i < 22; i++) {
    const [make, model, type, tank] = models[i % models.length]; const odo = ri(18000, 160000);
    const status = i < 15 ? 'assigned' : i < 19 ? 'available' : i < 21 ? 'maintenance' : 'out';
    const driverId = status === 'assigned' ? drivers[dIdx++].id : null;
    vehicles.push({ id: 'v' + String(i + 1).padStart(2, '0'), plateLetters: [pick(L), pick(L), pick(L)].join(' '), plateNumbers: String(ri(1000, 9999)), make, model, year: String(ri(2019, 2025)), color: pick(colors), type,
      vin: Array.from({ length: 17 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'[ri(0, 32)]).join(''), serialNo: String(ri(100000000, 999999999)), status, odometer: odo, hasOpCard: type === 'شاحنة' || type === 'باص', opCardNo: '', opCardExp: type === 'شاحنة' ? day(ri(-3, 200)) : '',
      istimaraExp: i === 2 ? day(9) : i === 6 ? day(-14) : day(ri(60, 900)), insuranceExp: i === 4 ? day(20) : day(ri(40, 360)), fahasExp: i === 9 ? day(4) : day(ri(30, 360)), oilEveryKm: 5000, lastOilKm: odo - (i === 1 || i === 7 ? 5600 : ri(500, 4300)), notes: '',
      fuelCard: 'FC-' + ri(100000, 999999), tankCapacity: tank, branchId: branches[i < 12 ? 0 : i < 18 ? 1 : 2].id, driverId, createdAt: now, updatedAt: now, demo: false });
  }
  const stations = ['ساسكو', 'نفط', 'الدريس', 'أرامكو – محطة الطريق', 'بترومين', 'المحروقات'];
  const fuel = [], maint = [], handovers = [], violations = [], charges = [], renewals = [], accidents = [];
  for (const v of vehicles) {
    if (v.status === 'out') continue;
    let odo = v.odometer - ri(9000, 15000); const per = v.type === 'شاحنة' ? 4.2 : v.type === 'باص' ? 6 : v.type === 'جيب / SUV' ? 7 : v.type === 'بيك أب' ? 8 : 11; const eff = per * (0.85 + rnd() * 0.3);
    for (let off = -180; off <= -1; off += ri(5, 9)) {
      const km = ri(380, 620); odo += km; const liters = Math.round(km / eff * (0.92 + rnd() * 0.16) * (v.id === 'v05' && off > -40 ? 1.45 : 1) * 10) / 10;
      fuel.push({ id: `f-${v.id}-${-off}`, vehicleId: v.id, driverId: v.driverId, date: day(off), odometer: odo, liters, cost: Math.round(liters * 2.33 * 100) / 100, station: pick(stations), demo: false, updatedAt: now });
    }
    for (let off = -170; off < 0; off += ri(45, 70)) maint.push({ id: `m-${v.id}-${-off}`, vehicleId: v.id, kind: 'oil', date: day(off), odometer: v.odometer - ri(1000, 9000), cost: ri(180, 320), workshop: pick(['بترومين إكسبرس', 'مركز الجميح', 'عبداللطيف جميل', 'ورشة النخبة']), details: 'زيت تخليقي 5W-30 مع الفلتر', nextDate: '', nextKm: null, status: 'done', demo: false, updatedAt: now });
    if (rnd() < 0.5) maint.push({ id: `m-${v.id}-x`, vehicleId: v.id, kind: pick(['tires', 'brakes', 'battery', 'ac', 'periodic']), date: day(-ri(10, 160)), odometer: v.odometer - ri(500, 6000), cost: ri(350, 2400), workshop: pick(['مركز الإطارات المتحدة', 'ورشة النخبة', 'الوكالة']), details: '', nextDate: '', nextKm: null, status: 'done', demo: false, updatedAt: now });
    if (v.status === 'maintenance') maint.push({ id: `m-${v.id}-open`, vehicleId: v.id, kind: 'repair', date: day(-ri(1, 4)), odometer: v.odometer, cost: ri(1500, 4800), workshop: 'الوكالة', details: 'عطل في ناقل الحركة – بانتظار قطعة', nextDate: '', nextKm: null, status: 'open', demo: false, updatedAt: now });
    if (v.driverId) handovers.push({ id: `h-${v.id}`, type: 'out', vehicleId: v.id, driverId: v.driverId, at: dt(-ri(20, 200)), odometer: v.odometer - ri(3000, 15000), fuel: 75, checks: { tires: true, spare: true, jack: true, ext: true, aid: true, tri: true, reg: true, ac: true, lights: true }, damages: rnd() < 0.3 ? 'خدش بسيط في الصدام الخلفي' : '', notes: '', by: 'عبدالله الشهري', photos: [], createdAt: now, demo: false });
  }
  const vk = ['ساهر – تجاوز السرعة', 'ساهر – تجاوز السرعة', 'ساهر – تجاوز السرعة', 'قطع إشارة', 'وقوف خاطئ', 'عدم ربط الحزام', 'استخدام الجوال'];
  const amt = { 'ساهر – تجاوز السرعة': [300, 900], 'قطع إشارة': [3000, 3000], 'وقوف خاطئ': [100, 300], 'عدم ربط الحزام': [150, 300], 'استخدام الجوال': [500, 900] };
  for (let i = 0; i < 26; i++) { const v = pick(vehicles.filter(x => x.driverId)); const k = pick(vk); violations.push({ id: 'vi' + i, vehicleId: v.id, date: dt(-ri(1, 170), ri(6, 23)), driverId: i % 5 === 0 ? drivers[2].id : v.driverId, kind: k, amount: ri(amt[k][0] / 50, amt[k][1] / 50) * 50, ref: String(ri(1000000000, 9999999999)), status: pick(['unpaid', 'unpaid', 'paid', 'deducted', 'objected']), notes: '', demo: false, updatedAt: now }); }
  charges.push({ id: 'ch1', driverId: drivers[4].id, vehicleId: vehicles[4].id, kind: 'damage', date: day(-12), amount: 850, status: 'pending', notes: 'كسر المرآة الجانبية', handoverId: null, accidentId: null, demo: false, updatedAt: now });
  charges.push({ id: 'ch2', driverId: drivers[9].id, vehicleId: vehicles[9].id, kind: 'fuel', date: day(-30), amount: 320, status: 'deducted', notes: 'تعبئة خارج المسار المعتمد', handoverId: null, accidentId: null, demo: false, updatedAt: now });
  charges.push({ id: 'ch3', driverId: drivers[1].id, vehicleId: vehicles[1].id, kind: 'custody', date: day(-45), amount: 150, status: 'waived', notes: 'فقدان المثلث العاكس', handoverId: null, accidentId: null, demo: false, updatedAt: now });
  for (const [i, doc] of [[0, 'istimara'], [3, 'insurance'], [5, 'fahas'], [8, 'insurance'], [11, 'istimara'], [14, 'fahas']]) renewals.push({ id: 'rn' + i, vehicleId: vehicles[i].id, doc, date: day(-ri(5, 150)), cost: doc === 'insurance' ? ri(1800, 4200) : doc === 'fahas' ? 73 : 150, newExp: vehicles[i][{ istimara: 'istimaraExp', insurance: 'insuranceExp', fahas: 'fahasExp' }[doc]], provider: doc === 'insurance' ? pick(['التعاونية', 'ولاء', 'ميدغلف']) : doc === 'fahas' ? 'الفحص الفني الدوري' : 'أبشر أعمال', ref: String(ri(100000, 999999)), notes: '', demo: false, updatedAt: now });
  accidents.push({ id: 'ac1', claim: { stage: 'review', claimNo: 'CLM-' + ri(100000, 999999) }, vehicleId: vehicles[19].id, date: dt(-6, 14), driverId: drivers[6].id, location: 'طريق الملك فهد – الرياض', najmNo: 'NJ' + ri(10000000, 99999999), fault: 0, status: 'claim', injuries: false, description: 'اصطدام من الخلف عند الإشارة', estCost: 4300, repairCost: 0, claimNo: '', insurancePaid: 0, driverCharge: 0, photos: [], demo: false, updatedAt: now });
  accidents.push({ id: 'ac2', claim: { stage: 'paid', claimNo: 'CLM-' + ri(100000, 999999), paidAmount: 2600 }, vehicleId: vehicles[7].id, date: dt(-75, 10), driverId: vehicles[7].driverId, location: 'جدة – شارع التحلية', najmNo: 'NJ' + ri(10000000, 99999999), fault: 25, status: 'closed', injuries: false, description: 'احتكاك جانبي أثناء الاصطفاف', estCost: 3100, repairCost: 2900, claimNo: '', insurancePaid: 2600, driverCharge: 0, photos: [], demo: false, updatedAt: now });
  // الفحص الأسبوعي: كل جمعة لآخر 8 أسابيع؛ ثلاث سيارات لم تُفحص في الدورة الحالية، وبعض البنود بملاحظات
  const inspections = []; const fri = -((new Date(Date.now() + 3 * 3600e3).getUTCDay() + 2) % 7);
  vehicles.filter(v => v.status !== 'out').forEach((v, vi) => { for (let w = 0; w < 8; w++) { if (w === 0 && [3, 9, 16].includes(vi)) continue; const off = fri - 7 * w + (rnd() < .3 ? 1 : 0); if (off > 0) continue;
    const it = {}; for (const k of ['tires', 'oil', 'water', 'lights']) it[k] = { ok: !(w === 0 && ((vi === 5 && k === 'tires') || (vi === 12 && k === 'lights'))) };
    inspections.push({ id: `in-${v.id}-${w}`, vehicleId: v.id, driverId: v.driverId, date: day(off), odometer: v.odometer - w * ri(350, 600), items: it, by: v.driverId ? drivers.find(d => d.id === v.driverId).name : 'مشرف الأسطول', demo: false, updatedAt: now }); } });
  Object.assign(out, { branches, drivers, vehicles, fuel, maintenance: maint, handovers, violations, charges, renewals, accidents, inspections });
  return out;
}

const mode = process.argv[2];
let s;
if (mode === 'signup') {
  try { s = await idt('signUp', { email: EMAIL, password: PASS, displayName: 'مدير العرض التجريبي', returnSecureToken: true }); }
  catch (e) { s = await idt('signInWithPassword', { email: EMAIL, password: PASS, returnSecureToken: true }); }
  await commit(s.idToken, [
    W(`companies/${CID}`, { name: 'شركة النموذج للنقل (عرض تجريبي)', ownerUid: s.localId, ownerEmail: EMAIL, ownerName: 'مدير العرض التجريبي', phone: '0500000000', status: 'pending', createdAt: now, submittedAt: now,
      profile: { legalName: 'شركة النموذج للنقل والخدمات اللوجستية (حساب عرض تجريبي)', crNumber: '1010000000', vatNumber: '', activity: 'نقل وخدمات لوجستية', fleetSize: '22', city: 'الرياض', district: 'العليا', street: 'طريق الملك فهد', buildingNo: '0000', postalCode: '12211', officialEmail: EMAIL, companyPhone: '0110000000', contactName: 'حساب العرض التجريبي', contactMobile: '0500000000' } }, true),
    W(`members/${EMAIL}`, { companyId: CID, at: now }, true)]);
  console.log('signup ok; company', CID, 'pending approval');
} else if (mode === 'seed') {
  s = await idt('signInWithPassword', { email: EMAIL, password: PASS, returnSecureToken: true });
  const data = build(); const writes = [W(`companies/${CID}/settings/main`, { companyName: 'شركة النموذج للنقل', updatedAt: now })];
  for (const [col, recs] of Object.entries(data)) for (const r of recs) { const { id, ...d } = r; writes.push(W(`companies/${CID}/${col}/${id}`, d)); }
  await commit(s.idToken, writes);
  console.log('seeded', Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])));
} else throw new Error('mode: signup | seed');
