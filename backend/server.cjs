const http = require('http');
const url = require('url');
const dbModule = require('./db.cjs');
const { initWebSocket } = require('./websocket.cjs');
const { ensureUploadDir } = require('./utils.cjs');
const handleArticlesRoutes = require('./routes/articles.cjs');
const handleDecosRoutes = require('./routes/decos.cjs');
const handleSettingsRoutes = require('./routes/settings.cjs');
const handleDraftsRoutes = require('./routes/drafts.cjs');
const { handleDecoUpload } = require('./upload.cjs');

ensureUploadDir();

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathname === '/api/decos' && method === 'POST') {
        handleDecoUpload(req, res);
        return;
    }

    // ★★★ 关键：草稿路由放在最前面 ★★★
    const handled =
        handleDraftsRoutes(req, res, parsedUrl, method) ||
        handleArticlesRoutes(req, res, parsedUrl, method) ||
        handleDecosRoutes(req, res, parsedUrl, method) ||
        handleSettingsRoutes(req, res, parsedUrl, method);

    if (!handled) {
        res.writeHead(404);
        res.end('Not found');
    }
});

initWebSocket(server);

const PORT = 9999;
dbModule.initDb().then(() => {
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`✅ API & WebSocket 服务运行在 http://127.0.0.1:${PORT}`);
        console.log('📁 贴纸图片存储于 SQLite BLOB');
        console.log('🗄️ 数据存储: SQLite (sql.js)');
        console.log('📝 文章草稿历史已启用');
    });
}).catch(err => {
    console.error('❌ 初始化失败:', err);
    process.exit(1);
});