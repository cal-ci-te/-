const dbModule = require('./db.cjs');
const { broadcast } = require('./websocket.cjs');

function handleDecoUpload(req, res) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { name, base64 } = data;
            if (!base64) {
                res.writeHead(400);
                res.end('No image data');
                return;
            }
            const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            const id = 'deco_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const savedName = name || '未命名贴纸';

            dbModule.run(
                'INSERT INTO decos (id, name, style, image_data) VALUES (?, ?, ?, ?)',
                [id, savedName, 'fixed', imageBuffer]
            );

            broadcast({
                type: 'deco_created',
                payload: { id, name: savedName, position: null, style: 'fixed' },
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id, dataUrl: base64, name: savedName }));
        } catch (err) {
            console.error('[Upload] 处理失败:', err);
            res.writeHead(400);
            res.end('Invalid JSON');
        }
    });
}

module.exports = { handleDecoUpload };