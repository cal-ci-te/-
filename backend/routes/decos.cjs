const { send } = require('../enhance.cjs');
const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function registerDecoRoutes(GET, PUT, DELETE) {

    // ===== GET /api/decos =====
    GET('/api/decos', async (req, res) => {
        const rows = dbModule.queryAll('SELECT id, name, position, style FROM decos');
        const result = rows.map(row => ({
            id: row.id,
            name: row.name,
            position: row.position ? JSON.parse(row.position) : null,
            style: row.style,
        }));
        send(res, result);
    });

    // ===== GET /api/decos/:id/image =====
    GET('/api/decos/:id/image', async (req, res) => {
        const id = req.params.id;
        const row = dbModule.query('SELECT image_data FROM decos WHERE id = ?', [id]);
        if (row && row.image_data) {
            const buffer = row.image_data instanceof Buffer ? row.image_data : Buffer.from(row.image_data);
            res.writeHead(200, {
                'Content-Type': 'image/webp',
                'Cache-Control': 'public, max-age=31536000',
            });
            res.end(buffer);
        } else {
            send(res, { error: 'Image not found' }, 404);
        }
    });

    // ===== PUT /api/decos/:id =====
    PUT('/api/decos/:id', async (req, res) => {
        const id = req.params.id;
        const updates = await json(req);
        const fields = [];
        const values = [];
        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.position !== undefined) { fields.push('position = ?'); values.push(JSON.stringify(updates.position)); }
        if (updates.style !== undefined) { fields.push('style = ?'); values.push(updates.style); }
        if (updates.dataUrl) {
            const base64Data = updates.dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            fields.push('image_data = ?');
            values.push(buffer);
        }
        if (fields.length === 0) {
            send(res, { error: 'No fields to update' }, 400);
            return;
        }
        values.push(id);
        const result = dbModule.exec('UPDATE decos SET ' + fields.join(', ') + ' WHERE id = ?', values);
        if (result.changes === 0) {
            send(res, { error: 'Deco not found' }, 404);
            return;
        }
        broadcast({ type: 'deco_updated', payload: { id, ...updates } });
        send(res, { success: true });
    });

    // ===== DELETE /api/decos/:id =====
    DELETE('/api/decos/:id', async (req, res) => {
        const id = req.params.id;
        dbModule.exec('DELETE FROM decos WHERE id = ?', [id]);
        broadcast({ type: 'deco_deleted', payload: { id } });
        send(res, { success: true });
    });
}

module.exports = { registerDecoRoutes };