const http = require('http');
const url = require('url');
const dbModule = require('./db.cjs');
const { initWebSocket } = require('./websocket.cjs');
const { ensureUploadDir } = require('./utils.cjs');
const { handleDecoUpload } = require('./upload.cjs');

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
registerDecoRoutes(GET, POST, PUT, DELETE);
registerSettingsRoutes(GET, POST, PUT, DELETE);
registerDraftsRoutes(GET, POST, PUT, DELETE);

ensureUploadDir();

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 特殊路由：贴图上传（需要处理 multipart/form-data）
    if (pathname === '/api/decos' && method === 'POST') {
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

// 启动服务
const PORT = 9999;
dbModule.initDb().then(() => {
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`✅ API & WebSocket 服务运行在 http://127.0.0.1:${PORT}`);
        console.log(`🔍 ErrPulse 仪表盘: http://localhost:3800`);
        console.log(`📁 贴纸存储于 SQLite BLOB`);
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