#!/usr/bin/env node
// نقل بيانات شركة منهل من المشروع الحالي (manhal-49df0) إلى مشروع SaaS الجديد كأول شركة
// - يقرأ من المشروع القديم فقط ولا يعدّل فيه شيئاً
// - ينسخ كل المجموعات (ومنها الرسائل الفرعية) إلى companies/<cid>/...
// - يبني فهرس العضوية members/ وروابط الجوال logins/ بالشركة
// - ينقل حسابات الدخول بنفس uid وكلمات المرور (بمعاملات التشفير من Firebase Console)
//
// الاستخدام:
//   cd tools && npm i firebase-admin
//   OLD_SA=/path/old-service-account.json NEW_SA=/path/new-service-account.json \
//   HASH_KEY=... SALT_SEPARATOR=... ROUNDS=8 MEM_COST=14 \
//   node migrate-manhal.mjs --company manhal --owner salmandh02@gmail.com [--dry-run] [--skip-auth]
//
// ملفات حسابات الخدمة ومعاملات التشفير أسرار: لا تُحفظ في المستودع.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]); return a; }, []));
const CID = String(args.company || 'manhal');
const OWNER = String(args.owner || '').toLowerCase();
const DRY = !!args['dry-run'];
const SKIP_AUTH = !!args['skip-auth'];
if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(CID)) throw new Error('company id: lowercase letters, digits, dashes (3-40)');
if (!OWNER) throw new Error('--owner <email> required');

function appFor(name, saEnv, projectEnv) {
  if (process.env[saEnv]) {
    const sa = JSON.parse(fs.readFileSync(process.env[saEnv], 'utf8'));
    return initializeApp({ credential: cert(sa), projectId: sa.project_id }, name);
  }
  // للاختبار على المحاكي: OLD_PROJECT / NEW_PROJECT مع FIRESTORE_EMULATOR_HOST
  if (process.env[projectEnv]) return initializeApp({ projectId: process.env[projectEnv] }, name);
  throw new Error(`${saEnv} not set`);
}
const OLD = appFor('old', 'OLD_SA', 'OLD_PROJECT'), NEW = appFor('new', 'NEW_SA', 'NEW_PROJECT');
const oldDb = getFirestore(OLD), newDb = getFirestore(NEW);
console.log(`من: ${OLD.options.projectId}  ←  إلى: ${NEW.options.projectId}/companies/${CID}${DRY ? '  (تجربة بدون كتابة)' : ''}`);
if (OLD.options.projectId === NEW.options.projectId) throw new Error('المشروعان متطابقان: هذا السكربت للنقل إلى مشروع جديد');

// المجموعات التي تبقى عامة في النظام الجديد (لا تُنسخ داخل الشركة)
const GLOBAL = new Set(['logins', 'members', 'companies']);
const counts = {}; let total = 0;
const writer = DRY ? null : newDb.bulkWriter();
writer && writer.onWriteError(e => { console.error('  write failed', e.documentRef.path, e.message); return e.failedAttempts < 3; });
const put = (path, data) => { total++; if (writer) writer.set(newDb.doc(path), data); };

async function copyCollection(col, destPrefix) {
  const snap = await col.get();
  for (const d of snap.docs) {
    const rel = d.ref.path; // مثل vehicles/abc أو threads/t1/messages/m1
    put(`${destPrefix}/${rel}`, d.data());
    counts[col.path.split('/').filter((_, i) => i % 2 === 0).join('/')] = (counts[col.path.split('/').filter((_, i) => i % 2 === 0).join('/')] || 0) + 1;
    for (const sub of await d.ref.listCollections()) await copyCollection(sub, destPrefix);
  }
}

// ---------- 1) البيانات ----------
const roots = await oldDb.listCollections();
const access = [], logins = [];
let settingsMain = null, reminders = null;
for (const col of roots) {
  if (col.id === 'logins') { (await col.get()).docs.forEach(d => logins.push([d.id, d.data()])); continue; }
  if (GLOBAL.has(col.id)) { console.log('  تخطّي مجموعة عامة موجودة مسبقاً:', col.id); continue; }
  if (col.id === 'access') (await col.get()).docs.forEach(d => access.push([d.id, d.data()]));
  if (col.id === 'settings') { const s = await col.get(); settingsMain = s.docs.find(d => d.id === 'main')?.data() || null; reminders = s.docs.find(d => d.id === 'reminders')?.data() || null; }
  await copyCollection(col, `companies/${CID}`);
}

// ---------- 2) حسابات الدخول (بنفس uid وكلمة المرور) ----------
let ownerUid = null, usersMoved = 0;
const oldAuth = getAuth(OLD), newAuth = getAuth(NEW);
if (!SKIP_AUTH) {
  const hash = { algorithm: 'SCRYPT', key: Buffer.from(process.env.HASH_KEY || '', 'base64'), saltSeparator: Buffer.from(process.env.SALT_SEPARATOR || '', 'base64'), rounds: +(process.env.ROUNDS || 8), memoryCost: +(process.env.MEM_COST || 14) };
  if (!process.env.HASH_KEY) throw new Error('HASH_KEY missing (Firebase Console ← Authentication ← Users ← ⋮ ← Password hash parameters), or pass --skip-auth');
  let page;
  do {
    const r = await oldAuth.listUsers(1000, page);
    const batch = r.users.map(u => ({ uid: u.uid, email: u.email, emailVerified: u.emailVerified, displayName: u.displayName, disabled: u.disabled,
      passwordHash: u.passwordHash ? Buffer.from(u.passwordHash, 'base64') : undefined, passwordSalt: u.passwordSalt ? Buffer.from(u.passwordSalt, 'base64') : undefined,
      metadata: { creationTime: u.metadata.creationTime, lastSignInTime: u.metadata.lastSignInTime } }));
    for (const u of r.users) if (String(u.email).toLowerCase() === OWNER) ownerUid = u.uid;
    if (!DRY && batch.length) {
      const res = await newAuth.importUsers(batch, { hash });
      res.errors.forEach(e => console.error('  user import failed', batch[e.index].email, e.error.message));
      usersMoved += res.successCount;
    } else usersMoved += batch.length;
    page = r.pageToken;
  } while (page);
} else {
  try { ownerUid = (await newAuth.getUserByEmail(OWNER)).uid; } catch (e) { try { ownerUid = (await oldAuth.getUserByEmail(OWNER)).uid; } catch (x) {} }
}

// ---------- 3) وثيقة الشركة والعضويات ----------
const now = new Date().toISOString();
const company = { name: settingsMain?.companyName || 'منهل', ownerUid: ownerUid || '', ownerEmail: OWNER, ownerName: '', phone: '', status: 'active', plan: 'founder', createdAt: now, migratedAt: now, migratedFrom: OLD.options.projectId };
if (reminders?.enabled && reminders.sysEmail) company.sysEmail = String(reminders.sysEmail).toLowerCase();
put(`companies/${CID}`, company);
// حساب التذكيرات مشترك بين الشركات فلا يُربط بشركة واحدة
const memberEmails = new Set([OWNER, ...access.filter(([, d]) => !d.system).map(([e]) => e.toLowerCase())]);
for (const e of memberEmails) put(`members/${e}`, { companyId: CID, at: now });
if (!access.some(([e]) => e.toLowerCase() === OWNER)) put(`companies/${CID}/access/${OWNER}`, { role: 'admin', name: '', owner: true, driverId: null, branchId: null, phone: null, inviteId: null, updatedAt: now });
for (const [ph, d] of logins) put(`logins/${ph}`, { ...d, companyId: CID });

if (writer) await writer.close();

// ---------- 4) تحقق ----------
console.log('\nالمجموعات المنقولة:'); Object.entries(counts).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));
console.log(`  members ${memberEmails.size} · logins ${logins.length} · users ${usersMoved}${SKIP_AUTH ? ' (تخطّي)' : ''}`);
if (!DRY) {
  let bad = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (k.includes('/')) continue; // الفرعية تُتحقق ضمن الأم
    const n = (await newDb.collection(`companies/${CID}/${k}`).count().get()).data().count;
    if (n < v) { bad++; console.error(`  ✗ ${k}: ${n} من ${v}`); }
  }
  console.log(bad ? `\n⚠️ ${bad} مجموعة ناقصة` : `\n✓ اكتمل النقل: ${total} وثيقة. الشركة ${CID} مفعّلة ومالكها ${OWNER}`);
  if (!ownerUid) console.warn('⚠️ لم يُعثر على uid المالك؛ أكمله يدوياً في companies/' + CID + '.ownerUid');
}
process.exit(0);
