const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function handleDecosRoutes(req, res, parsedUrl, method) {
    const pathname = parsedUrl.pathname;
    console.log(`[decos] ${method} ${pathname}`);

    // GET /api/decos
    if (pathname === '/api/decos' && method === 'GET') {
        try {
            const rows = dbModule.queryAll('SELECT id, name, position, style FROM decos');
            const result = rows.map(row => ({
                id: row.id,
                name: row.name,
                position: row.position ? JSON.parse(row.position) : null,
                style: row.style,
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            console.error('[DB] 查询贴纸失败:', err);
            res.writeHead(500);
            res.end('Database error');
        }
        return true;
    }

// GET /api/decos/:id/image
const imageMatch = pathname.match(/^\/api\/decos\/([^/]+)\/image$/);
if (imageMatch && method === 'GET') {
    const id = imageMatch[1];
    console.log('[decos] 请求图片:', id, '类型:', typeof id);
    try {
        const row = dbModule.query('SELECT image_data FROM decos WHERE id = ?', [id]);
        console.log('[decos] 查询结果:', row);
        if (row && row.image_data) {
            const buffer = row.image_data instanceof Buffer ? row.image_data : Buffer.from(row.image_data);
            console.log('[decos] 找到图片，大小:', buffer.length);
            res.writeHead(200, {
                'Content-Type': 'image/webp',
                'Cache-Control': 'public, max-age=31536000',
            });
            res.end(buffer);
        } else {
            console.warn('[decos] 图片不存在:', id);
            // 额外检查表中所有 ID
            const allIds = dbModule.queryAll('SELECT id FROM decos');
            console.log('[decos] 表中所有 ID:', allIds.map(r => r.id));
            res.writeHead(404);
            res.end('Image not found');
        }
    } catch (err) {
        console.error('[DB] 获取图片失败:', err);
        res.writeHead(500);
        res.end('Database error');
    }
    return true;
}

    // POST /api/decos (已被 server.cjs 接管，此处不会执行)
    if (pathname === '/api/decos' && method === 'POST') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return true;
    }

    // PUT /api/decos/:id
    const updateMatch = pathname.match(/^\/api\/decos\/([^/]+)$/);
    if (updateMatch && method === 'PUT') {
        const id = updateMatch[1];
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const fields = [];
                const values = [];
                if (updates.name !== undefined) {
                    fields.push('name = ?');
                    values.push(updates.name);
                }
                if (updates.position !== undefined) {
                    fields.push('position = ?');
                    values.push(JSON.stringify(updates.position));
                }
                if (updates.style !== undefined) {
                    fields.push('style = ?');
                    values.push(updates.style);
                }
                if (updates.dataUrl) {
                    const base64Data = updates.dataUrl.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    fields.push('image_data = ?');
                    values.push(buffer);
                }
                if (fields.length === 0) {
                    res.writeHead(400);
                    res.end('No fields to update');
                    return;
                }
                values.push(id);
                const sql = 'UPDATE decos SET ' + fields.join(', ') + ' WHERE id = ?';
                const result = dbModule.exec(sql, values);
                if (result.changes === 0) {
                    res.writeHead(404);
                    res.end('Deco not found');
                    return;
                }
                broadcast({ type: 'deco_updated', payload: { id, ...updates } });
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

    // DELETE /api/decos/:id
    const deleteMatch = pathname.match(/^\/api\/decos\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
        const id = deleteMatch[1];
        try {
            dbModule.exec('DELETE FROM decos WHERE id = ?', [id]);
            broadcast({ type: 'deco_deleted', payload: { id } });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return true;
        } catch (err) {
            console.error('[DB] 删除贴纸失败:', err);
            res.writeHead(500);
            res.end('Database error');
            return true;
        }
    }

    return false;
}

module.exports = handleDecosRoutes;