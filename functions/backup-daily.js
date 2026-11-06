// نسخة احتياطية يومية الساعة 2 فجراً بتوقيت الرياض
const { runBackup } = require('./lib/backup-core');
exports.handler = async () => { try { const r = await runBackup('schedule'); console.log('backup', JSON.stringify(r)); return { statusCode: 200, body: JSON.stringify(r) }; } catch (e) { console.error(e); return { statusCode: 500, body: e.message }; } };
