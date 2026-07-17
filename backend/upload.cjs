const dbModule = require('./db.cjs');  // 注意 './' 表示当前目录
const { broadcast } = require('./websocket.cjs');

function handleDecoUpload(req, res) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { name, base64 } = data;
            console.log('[Upload] 接收到的 name:', name);
            console.log('[Upload] base64 长度:', base64 ? base64.length : '无');

            if (!base64) {
                console.warn('[Upload] base64 为空');
                res.writeHead(400);
                res.end('No image data');
                return;
            }

            const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            console.log('[Upload] 图片 Buffer 长度:', imageBuffer.length);

            if (imageBuffer.length === 0) {
                console.warn('[Upload] 图片 Buffer 为空');
                res.writeHead(400);
                res.end('Invalid image data');
                return;
            }

            const id = 'deco_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const savedName = name || '未命名贴纸';

            console.log('[Upload] 准备插入贴纸:', id, savedName, '图片大小:', imageBuffer.length);

            // 使用 dbModule.run 插入
            const result = dbModule.run(
                'INSERT INTO decos (id, name, style, image_data) VALUES (?, ?, ?, ?)',
                [id, savedName, 'fixed', imageBuffer]
            );
            console.log('[Upload] dbModule.run 结果:', result);

            // 验证插入
            const verifyRow = dbModule.query('SELECT id, length(image_data) as img_len FROM decos WHERE id = ?', [id]);
            console.log('[Upload] ✅ 验证成功，image_data 大小:', verifyRow ? verifyRow.img_len : '无');

            if (!verifyRow || verifyRow.img_len === 0) {
                console.error('[Upload] ❌ 验证失败：image_data 未保存');
                res.writeHead(500);
                res.end('Image data not saved');
                return;
            }

            broadcast({
                type: 'deco_created',
                payload: { id, name: savedName, position: null, style: 'fixed' },
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: id,
                dataUrl: base64,
                name: savedName,
            }));
        } catch (err) {
            console.error('[Upload] 处理失败:', err);
            res.writeHead(400);
            res.end('Invalid JSON');
        }
    });
}

module.exports = { handleDecoUpload };