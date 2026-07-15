const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function handleSettingsRoutes(req, res, parsedUrl, method) {
    const pathname = parsedUrl.pathname;

    // GET /api/settings
    if (pathname === '/api/settings' && method === 'GET') {
        try {
            const rows = dbModule.queryAll('SELECT key, value FROM settings');
            const settings = {};
            rows.forEach((row) => {
                try {
                    settings[row.key] = JSON.parse(row.value);
                } catch (e) {
                    settings[row.key] = row.value;
                }
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(settings));
        } catch (err) {
            console.error('[DB] 查询设置失败:', err);
            res.writeHead(500);
            res.end('Database error');
        }
        return true;
    }

    // PUT /api/settings
    if (pathname === '/api/settings' && method === 'PUT') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const settings = JSON.parse(body);
                Object.entries(settings).forEach(([key, value]) => {
                    dbModule.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
                        key,
                        JSON.stringify(value),
                    ]);
                });
                broadcast({ type: 'settings_updated', payload: settings });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error(e);
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return true;
    }

    return false;
}

module.exports = handleSettingsRoutes;