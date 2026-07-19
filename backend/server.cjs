const http = require('http');
const dbModule = require('./db.cjs');
const { initWebSocket } = require('./websocket.cjs');
const { ensureUploadDir } = require('./utils.cjs');
const { handleDecoUpload } = require('./upload.cjs');

// 存储层：通过适配器模式在本地文件系统 / S3 兼容存储之间切换，业务代码无感知
const { storage } = require('./storage/index.cjs');
console.log('[Server] 存储服务已初始化:', storage.isLocal() ? '本地' : 'RustFS');

// 自研路由层（enhance.cjs）：因项目仅 ~15 个 API 端点，引入 Express 会导致工具代码超过业务代码。
// 若后续 API 增长至 50+，可无缝迁移至 Express/k 的控制器结构。
const { GET, POST, PUT, DELETE, match, routes } = require('./enhance.cjs');

const { init } = require('@errpulse/node');
init({ serverUrl: 'http://localhost:3800', projectId: 'revachol-backend', enabled: true });

const { registerArticleRoutes } = require('./routes/articles.cjs');
const { registerDecoRoutes } = require('./routes/decos.cjs');
const { registerSettingsRoutes } = require('./routes/settings.cjs');
const { registerDraftsRoutes } = require('./routes/drafts.cjs');

registerArticleRoutes(GET, POST, PUT, DELETE);
registerDecoRoutes(GET, PUT, DELETE);
registerSettingsRoutes(GET, PUT);
registerDraftsRoutes(GET, POST, PUT, DELETE);

console.log('[Server] 已注册路由 — GET:', Object.keys(routes.GET || {}),
  'POST:', Object.keys(routes.POST || {}),
  'PUT:', Object.keys(routes.PUT || {}),
  'DELETE:', Object.keys(routes.DELETE || {}));

ensureUploadDir();

const { cleanExpiredDrafts } = require('./cleanup-drafts.cjs');
setTimeout(() => { cleanExpiredDrafts(); }, 3000);

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS：开发环境 Vite 端口 (3000) 与后端 (9999) 不同源
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // 贴图上传需要手动处理请求体（FormData / base64 JSON），不走通用 json() 解析
    if (pathname === '/api/decos' && method === 'POST') {
        handleDecoUpload(req, res);
        return;
    }

    const handler = match(method, pathname);
    if (handler) {
        try {
            await handler(req, res);
        } catch (err) {
            console.error('[Server] 路由错误:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Internal error' }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

initWebSocket(server);

server.on('error', (err) => { console.error('❌ 服务器错误:', err); });

const PORT = 9999;
dbModule.initDb().then(() => {
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`✅ API & WebSocket 服务运行在 http://127.0.0.1:${PORT}`);
        console.log(`🔍 ErrPulse 仪表盘: http://localhost:3800`);
        console.log(`📁 贴纸存储于: ${storage.isLocal() ? '本地文件系统' : 'MinIO/RustFS'}`);
    });
}).catch(err => {
    console.error('❌ 数据库初始化失败:', err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务...');
    server.close(() => {
        console.log('✅ 服务已关闭');
        if (dbModule.closeDb) dbModule.closeDb();
        process.exit(0);
    });
});
