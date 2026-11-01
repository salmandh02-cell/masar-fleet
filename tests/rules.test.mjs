import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import fs from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'demo-fleet', firestore: { rules: fs.readFileSync('/home/claude/fleet-saas/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
await env.clearFirestore();
const U = (uid, email, v = true) => env.authenticatedContext(uid, { email, email_verified: v }).firestore();
const alice = U('ua', 'alice@a.com'), bob = U('ub', 'bob@b.com'), sup = U('us', 'salmandh02@gmail.com');
const drvEmail = '966500000001.123456@m.manhalfleet.app';
const drv = U('ud', drvEmail, false), anon = env.unauthenticatedContext().firestore();
const unver = U('ux', 'x@x.com', false);
let pass = 0, fail = 0;
async function t(name, p, ok = true) { try { await (ok ? assertSucceeds(p) : assertFails(p)); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '-', e.message.split('\n')[0]); } }
function signup(db, cid, uid, email, extra = {}) {
  const b = db.batch(); const now = new Date().toISOString();
  b.set(db.doc(`companies/${cid}`), { name: 'Co ' + cid, ownerUid: uid, ownerEmail: email, ownerName: 'n', phone: '', status: 'trial', plan: 'trial', createdAt: now, trialEnds: '2030-01-01', ...extra });
  b.set(db.doc(`members/${email}`), { companyId: cid, at: now });
  b.set(db.doc(`companies/${cid}/access/${email}`), { role: 'admin', name: 'n', phone: null, driverId: null, branchId: null, inviteId: null, owner: true, updatedAt: now });
  return b.commit();
}
console.log('تسجيل الشركات');
await t('unverified email cannot create company', signup(unver, 'cx-unver', 'ux', 'x@x.com'), false);
await t('cannot self-create as active', signup(alice, 'ca-111', 'ua', 'alice@a.com', { status: 'active' }), false);
await t('cannot create company for someone else', signup(alice, 'ca-111', 'ub', 'bob@b.com'), false);
await t('alice signs up company A', signup(alice, 'ca-111', 'ua', 'alice@a.com'));
await t('alice writes settings/main', alice.doc('companies/ca-111/settings/main').set({ companyName: 'A' }));
await t('alice cannot create a 2nd company', signup(alice, 'ca-222', 'ua', 'alice@a.com'), false);
await t('bob signs up company B', signup(bob, 'cb-111', 'ub', 'bob@b.com'));
await t('bob cannot take over company A id', signup(bob, 'ca-111', 'ub', 'bob@b.com'), false);

console.log('العزل بين الشركات');
await t('alice adds vehicle in A', alice.doc('companies/ca-111/vehicles/v1').set({ plateNumbers: '1', status: 'assigned', driverId: 'd1' }));
await t('bob adds vehicle in B', bob.doc('companies/cb-111/vehicles/v9').set({ plateNumbers: '9' }));
await t('alice reads A vehicles', alice.collection('companies/ca-111/vehicles').get());
await t('alice cannot read B vehicles', alice.collection('companies/cb-111/vehicles').get(), false);
await t('alice cannot write into B', alice.doc('companies/cb-111/vehicles/x').set({ a: 1 }), false);
await t('alice cannot read B company doc', alice.doc('companies/cb-111').get(), false);
await t('bob cannot read A settings', bob.doc('companies/ca-111/settings/main').get(), false);
await t('alice cannot list all companies', alice.collection('companies').get(), false);
await t('alice cannot list members', alice.collection('members').get(), false);
await t('alice cannot read bob membership', alice.doc('members/bob@b.com').get(), false);

console.log('دعوة المستخدمين');
await t('alice invites driver (members)', alice.doc(`members/${drvEmail}`).set({ companyId: 'ca-111', at: 'x' }));
await t('alice invites driver (access)', alice.doc(`companies/ca-111/access/${drvEmail}`).set({ role: 'driver', driverId: 'd1', branchId: null, name: 'D', phone: '0500000001', inviteId: 'i1' }));
await t('bob cannot steal driver into B', bob.doc(`members/${drvEmail}`).set({ companyId: 'cb-111', at: 'x' }), false);
await t('bob cannot claim alice into B', bob.doc(`members/alice@a.com`).set({ companyId: 'cb-111', at: 'x' }), false);
await t('bob cannot delete alice membership', bob.doc(`members/alice@a.com`).delete(), false);
await t('alice cannot point her member doc to B', alice.doc(`members/alice@a.com`).set({ companyId: 'cb-111', at: 'x' }), false);
await t('bob cannot grant himself access in A', bob.doc(`companies/ca-111/access/bob@b.com`).set({ role: 'admin' }), false);

console.log('دخول السائق برقم الجوال');
await t('anon gets login mapping (missing ok)', anon.doc('logins/0500000001').get());
await t('anon cannot list logins', anon.collection('logins').get(), false);
await t('driver writes own login mapping', drv.doc('logins/0500000001').set({ email: drvEmail, phone: '0500000001', companyId: 'ca-111', at: 'x' }));
await t('bob cannot overwrite driver login', bob.doc('logins/0500000001').set({ email: 'bob@b.com', phone: '0500000001', companyId: 'cb-111', at: 'x' }), false);
await t('driver reads A vehicles', drv.collection('companies/ca-111/vehicles').get());
await t('driver updates odometer only', drv.doc('companies/ca-111/vehicles/v1').update({ odometer: 100 }));
await t('driver cannot change status', drv.doc('companies/ca-111/vehicles/v1').update({ status: 'available' }), false);
await t('driver cannot read audit', drv.collection('companies/ca-111/audit').get(), false);
await t('driver cannot read B', drv.collection('companies/cb-111/vehicles').get(), false);

console.log('الرسائل');
await t('driver opens thread with owner', drv.doc('companies/ca-111/threads/t1').set({ participants: [drvEmail, 'alice@a.com'].sort() }));
await t('driver posts message', drv.doc('companies/ca-111/threads/t1/messages/m1').set({ from: drvEmail, text: 'hi' }));
await t('alice reads thread messages', alice.collection('companies/ca-111/threads/t1/messages').get());
await t('bob cannot read A messages', bob.collection('companies/ca-111/threads/t1/messages').get(), false);

console.log('حالة الشركة ولوحة المالك');
await t('alice cannot change own status', alice.doc('companies/ca-111').update({ status: 'active' }), false);
await t('alice cannot extend own trial', alice.doc('companies/ca-111').update({ trialEnds: '2099-01-01' }), false);
await t('alice renames company', alice.doc('companies/ca-111').update({ name: 'A2', updatedAt: 'x' }));
await t('super lists companies', sup.collection('companies').get());
await t('super counts A vehicles', sup.collection('companies/ca-111/vehicles').get());
await t('super cannot read A drivers', sup.collection('companies/ca-111/drivers').get(), false);
await t('super suspends A', sup.doc('companies/ca-111').update({ status: 'suspended' }));
await t('suspended: alice cannot read vehicles', alice.collection('companies/ca-111/vehicles').get(), false);
await t('suspended: driver cannot read vehicles', drv.collection('companies/ca-111/vehicles').get(), false);
await t('suspended: alice still sees company doc (status msg)', alice.doc('companies/ca-111').get());
await t('suspended: B unaffected', bob.collection('companies/cb-111/vehicles').get());
await t('super reactivates A', sup.doc('companies/ca-111').update({ status: 'active', plan: 'شهري', paidUntil: '2026-12-01' }));
await t('active: alice reads again', alice.collection('companies/ca-111/vehicles').get());

console.log('حساب التذكيرات');
const sys = U('usys', 'sys@fleet.app');
await t('alice grants sys viewer access', alice.doc('companies/ca-111/access/sys@fleet.app').set({ role: 'viewer', system: true }));
await t('alice sets sysEmail on company', alice.doc('companies/ca-111').update({ sysEmail: 'sys@fleet.app', updatedAt: 'y' }));
await t('sys lists its companies', sys.collection('companies').where('sysEmail', '==', 'sys@fleet.app').get());
await t('sys cannot list all companies', sys.collection('companies').get(), false);
await t('sys reads A vehicles', sys.collection('companies/ca-111/vehicles').get());
await t('sys cannot read B', sys.collection('companies/cb-111/vehicles').get(), false);
await t('sys cannot write A', sys.doc('companies/ca-111/vehicles/v1').update({ odometer: 1 }), false);

console.log(`\n${pass} نجح، ${fail} فشل`);
await env.cleanup();
process.exit(fail ? 1 : 0);
