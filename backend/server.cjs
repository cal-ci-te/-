const http = require('http');
const url = require('url');
const dbModule = require('./db.cjs');
const { initWebSocket } = require('./websocket.cjs');
const { ensureUploadDir } = require('./utils.cjs');
const { handleDecoUpload } = require('./upload.cjs');

// ===== 存储服务初始化 =====
const { storage } = require('./storage/index.cjs');
console.log('[Server] 存储服务已初始化:', storage.isLocal() ? '本地' : 'RustFS');

// ===== 增强层 =====
const { GET, POST, PUT, DELETE, match } = require('./enhance.cjs');

// ===== ErrPulse 集成 =====
const { init } = require('@errpulse/node');
init({
    serverUrl: 'http://localhost:3800',
    projectId: 'revachol-backend',
    enabled: true,
});

// ===== 注册所有路由 =====
const { registerArticleRoutes } = require('./routes/articles.cjs');
const { registerDecoRoutes } = require('./routes/decos.cjs');
const { registerSettingsRoutes } = require('./routes/settings.cjs');
const { registerDraftsRoutes } = require('./routes/drafts.cjs');

registerArticleRoutes(GET, POST, PUT, DELETE);
registerDecoRoutes(GET, PUT, DELETE);
registerSettingsRoutes(GET, PUT);
registerDraftsRoutes(GET, POST, PUT, DELETE);  // ✅ 修复

ensureUploadDir();

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    console.log(`[Server] ${method} ${pathname}`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ===== 特殊路由：贴图上传 =====
    if (pathname === '/api/decos' && method === 'POST') {
        console.log('[Server] 匹配到 /api/decos POST 路由');
        handleDecoUpload(req, res);
        return;
    }

    // 路由匹配
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

// WebSocket 集成
initWebSocket(server);

// 服务器错误监听
server.on('error', (err) => {
    console.error('❌ 服务器错误:', err);
});

// 启动服务
const PORT = 9999;

console.log('[Server] 准备初始化数据库...');

dbModule.initDb().then(() => {
    console.log('[Server] 数据库初始化完成，开始启动服务器...');
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
        if (dbModule.closeDb) {
            dbModule.closeDb();
        }
        process.exit(0);
    });
});