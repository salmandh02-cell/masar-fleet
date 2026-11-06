// نسخة احتياطية فورية أو متابعة حالتها: لمالك المنصة فقط
const B = require('./lib/backup-core'); const P = require('./lib/plat-core');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return J(405, { error: 'POST only' });
  const auth = event.headers.authorization || event.headers.Authorization || ''; if (!auth.startsWith('Bearer ')) return J(401, { error: 'no token' });
  try {
    const me = await P.whoIs(auth.slice(7)); if (!me || me.email !== P.SUPER() || !me.verified) return J(403, { error: 'owner only' });
    let req = {}; try { req = JSON.parse(event.body || '{}'); } catch (e) {}
    if (req.action === 'status') return J(200, await B.opStatus(req.op));
    return J(200, await B.runBackup('owner'));
  } catch (e) { console.error(e); return J(500, { ok: false, error: e.message }); }
};
