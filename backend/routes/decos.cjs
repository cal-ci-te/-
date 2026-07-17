const { send, json } = require('../enhance.cjs'); 
const { storage } = require('../storage/index.cjs');
const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function registerDecoRoutes(GET, PUT, DELETE) {

    // ===== GET /api/decos =====
GET('/api/decos', async (req, res) => {
    const rows = dbModule.queryAll('SELECT id, name, position, style, image_path FROM decos');
    const result = rows.map(row => ({
        id: row.id,
        name: row.name,
        position: row.position ? JSON.parse(row.position) : null,
        style: row.style,
        dataUrl: `/api/decos/${row.id}/image`, // 统一通过图片路由获取
    }));
    send(res, result);
});

    // ===== GET /api/decos/:id/image =====
    GET('/api/decos/:id/image', async (req, res) => {
        const id = req.params.id;
        console.log('[Decos] 请求图片 ID:', id);

        try {
            const row = dbModule.query('SELECT image_path FROM decos WHERE id = ?', [id]);
            if (!row || !row.image_path) {
                send(res, { error: 'Image not found' }, 404);
                return;
            }

            // 提取文件名（如果 image_path 是路径，取最后一个部分）
            const filename = row.image_path.includes('/') 
                ? row.image_path.split('/').pop() 
                : row.image_path;

            // ===== 通过 StorageService 读取 =====
            const buffer = await storage.read(filename);
            if (buffer) {
                res.writeHead(200, {
                    'Content-Type': 'image/webp',
                    'Cache-Control': 'public, max-age=31536000',
                });
                res.end(buffer);
                return;
            }

            // 如果 RustFS 没找到，尝试从本地读取（兼容旧数据）
            if (!storage.isLocal()) {
                const LocalAdapter = require('../storage/adapters/local.cjs');
                const local = new LocalAdapter();
                const localBuffer = await local.read(filename);
                if (localBuffer) {
                    res.writeHead(200, {
                        'Content-Type': 'image/webp',
                        'Cache-Control': 'public, max-age=31536000',
                    });
                    res.end(localBuffer);
                    return;
                }
            }

            console.warn('[Decos] ❌ 图片不存在, ID:', id);
            send(res, { error: 'Image not found' }, 404);
        } catch (err) {
            console.error('[Decos] ❌ 获取图片错误:', err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Database error' }));
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
        // 如果更新了 dataUrl，意味着要更新图片
        if (updates.dataUrl) {
            // 注意：这里需处理 Base64 → Buffer 并重新上传
            const base64Data = updates.dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            // 获取原文件名
            const oldRow = dbModule.query('SELECT image_path FROM decos WHERE id = ?', [id]);
            const oldFilename = oldRow && oldRow.image_path ? oldRow.image_path.split('/').pop() : null;
            // 上传新图片
            const result = await storage.upload(buffer, 'update.webp', 'image/webp');
            // 删除旧文件
            if (oldFilename) {
                await storage.delete(oldFilename);
            }
            fields.push('image_path = ?');
            values.push(result.key);
            updates.dataUrl = result.url; // 更新返回的 URL
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
        // 获取图片路径以便删除文件
        const row = dbModule.query('SELECT image_path FROM decos WHERE id = ?', [id]);
        if (row && row.image_path) {
            const filename = row.image_path.split('/').pop();
            await storage.delete(filename);
        }
        dbModule.exec('DELETE FROM decos WHERE id = ?', [id]);
        broadcast({ type: 'deco_deleted', payload: { id } });
        send(res, { success: true });
    });
}

module.exports = { registerDecoRoutes };