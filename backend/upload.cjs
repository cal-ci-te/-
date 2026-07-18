// 贴图上传处理器：接收 base64 JSON（前端已压缩为 WebP），解码后通过 StorageService 存储。
// 走特殊路由而非通用 JSON 解析是因为请求体可能很大（>100KB base64），
// 流式读取避免阻塞事件循环。
const { storage } = require('./storage/index.cjs');
const { broadcast } = require('./websocket.cjs');
const dbModule = require('./db.cjs');

function handleDecoUpload(req, res) {
    console.log('[Upload] 收到上传请求');

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
        console.log('[Upload] 请求体接收完毕，长度:', body.length);
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

            const savedName = name || '未命名贴纸';
            const filename = savedName + '.webp';

            console.log('[Upload] 准备调用 storage.upload，文件名:', filename);

            // 上传到存储服务
            const result = await storage.upload(imageBuffer, filename, 'image/webp');
            console.log('[Upload] storage.upload 返回结果:', result);

            // 保存到数据库
            dbModule.run(
                'INSERT INTO decos (id, name, style, image_path) VALUES (?, ?, ?, ?)',
                [result.id, savedName, 'fixed', result.key]
            );

            broadcast({
                type: 'deco_created',
                payload: {
                    id: result.id,
                    name: savedName,
                    position: null,
                    style: 'fixed',
                    dataUrl: `/api/decos/${result.id}/image`,
                },
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: result.id,
                dataUrl: `/api/decos/${result.id}/image`,
                name: savedName,
            }));
        } catch (err) {
            console.error('[Upload] 处理失败:', err);
            console.error('[Upload] 错误堆栈:', err.stack);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });

    req.on('error', (err) => {
        console.error('[Upload] 请求错误:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
    });
}

module.exports = { handleDecoUpload };