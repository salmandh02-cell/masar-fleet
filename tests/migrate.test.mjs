import { createRequire } from 'node:module'; const require = createRequire('/home/claude/emu/');
const { initializeApp } = require('firebase-admin/app'); const { getFirestore } = require('firebase-admin/firestore'); const { getAuth } = require('firebase-admin/auth'); const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
const old = initializeApp({ projectId: 'demo-old' }, 'o'); const odb = getFirestore(old);
const seed = { 'settings/main': { companyName: 'منهل' }, 'settings/reminders': { enabled: true, sysEmail: 'SYS@x.app' }, 'vehicles/v1': { plateNumbers: '1' }, 'vehicles/v2': { plateNumbers: '2' },
  'drivers/d1': { name: 'D' }, 'access/fleet@m.sa': { role: 'fleet' }, 'access/966500000001.111111@m.manhalfleet.app': { role: 'driver', phone: '0500000001', driverId: 'd1' },
  'invites/i1': { role: 'fleet', email: 'fleet@m.sa' }, 'logins/0500000001': { email: '966500000001.111111@m.manhalfleet.app', phone: '0500000001' },
  'threads/t1': { participants: ['a', 'b'] }, 'threads/t1/messages/m1': { from: 'a', text: 'hi' }, 'threads/t1/messages/m2': { from: 'b', text: 'yo' }, 'audit/a1': { uid: 'u' }, 'blobs/b1': { data: 'xx', chunks: 1 } };
for (const [p, d] of Object.entries(seed)) await odb.doc(p).set(d);
const ownerU = await getAuth(old).createUser({ email: 'salmandh02@gmail.com', password: 'pw123456', emailVerified: true });
console.log(execFileSync('node', ['/home/claude/fleet-saas/tools/migrate-manhal.mjs', '--company', 'manhal', '--owner', 'salmandh02@gmail.com', '--skip-auth'],
  { env: { ...process.env, OLD_PROJECT: 'demo-old', NEW_PROJECT: 'demo-new', NODE_PATH: '/home/claude/emu/node_modules' }, encoding: 'utf8' }));
const env = await initializeTestEnvironment({ projectId: 'demo-new', firestore: { rules: fs.readFileSync('/home/claude/fleet-saas/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
let pass = 0, fail = 0; const t = async (n, p, ok = true) => { try { await (ok ? assertSucceeds(p) : assertFails(p)); pass++; console.log('  ✓', n); } catch (e) { fail++; console.log('  ✗', n, e.message.split('\n')[0]); } };
await env.withSecurityRulesDisabled(async c => { const db = c.firestore();
  const co = (await db.doc('companies/manhal').get()).data(); console.log('  company:', JSON.stringify(co));
  t('company active, named منهل, sysEmail lowercased, ownerUid kept', Promise.resolve(co.status === 'active' && co.name === 'منهل' && co.sysEmail === 'sys@x.app' && co.ownerUid === ownerU.uid ? 1 : Promise.reject(new Error('bad'))));
  const m = (await db.collection('companies/manhal/threads/t1/messages').get()).size; await t('sub-collection messages copied (2)', m === 2 ? Promise.resolve() : Promise.reject(new Error(m)));
  const l = (await db.doc('logins/0500000001').get()).data(); await t('login mapping has companyId', l.companyId === 'manhal' ? Promise.resolve() : Promise.reject(new Error(JSON.stringify(l))));
  const r = (await db.collection('vehicles').get()).size; await t('nothing written to old root paths', r === 0 ? Promise.resolve() : Promise.reject(new Error(r)));
});
const ownr = env.authenticatedContext(ownerU.uid, { email: 'salmandh02@gmail.com', email_verified: true }).firestore();
const drv = env.authenticatedContext('ud', { email: '966500000001.111111@m.manhalfleet.app', email_verified: false }).firestore();
await t('owner reads migrated vehicles via rules', ownr.collection('companies/manhal/vehicles').get());
await t('owner reads audit via rules', ownr.collection('companies/manhal/audit').get());
await t('owner membership resolves', ownr.doc('members/salmandh02@gmail.com').get());
await t('driver reads vehicles via rules', drv.collection('companies/manhal/vehicles').get());
await t('driver cannot read audit', drv.collection('companies/manhal/audit').get(), false);
const ov = (await odb.collection('vehicles').get()).size; await t('old project untouched', ov === 2 ? Promise.resolve() : Promise.reject(new Error(ov)));
console.log(`\n${pass} نجح، ${fail} فشل`); await env.cleanup(); process.exit(fail ? 1 : 0);
