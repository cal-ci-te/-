const { send, json } = require('../enhance.cjs');
const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function registerSettingsRoutes(GET, PUT) {

    GET('/api/settings', async (req, res) => {
        const rows = dbModule.queryAll('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(row => {
            try { settings[row.key] = JSON.parse(row.value); } catch (e) { settings[row.key] = row.value; }
        });
        send(res, settings);
    });

    PUT('/api/settings', async (req, res) => {
        const settings = await json(req);
        Object.entries(settings).forEach(([key, value]) => {
            dbModule.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
        });
        broadcast({ type: 'settings_updated', payload: settings });
        send(res, { success: true });
    });
}

module.exports = { registerSettingsRoutes };