const http = require('http');
const dbModule = require('./db.cjs');
const { initWebSocket } = require('./websocket.cjs');
const { ensureUploadDir } = require('./utils.cjs');
const { handleDecoUpload } = require('./upload.cjs');

// 认证模块：Token 生成/验证/撤销 + requireAuth 包装器
const { requireAuth, generateToken, revokeToken } = require('./auth.js');

// 管理员凭据：优先从环境变量读取，未设置时回退到默认值（开发环境兼容）
// 生产部署时通过 .env 或 docker-compose.yml 注入 ADMIN_PASSWORD 环境变量
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

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

const { cleanExpiredDrafts, enforceDraftLimit } = require('./cleanup-drafts.cjs');
setTimeout(() => { cleanExpiredDrafts(); enforceDraftLimit(); }, 3000);

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS：开发环境 Vite 端口 (3000) 与后端 (9999) 不同源
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // 贴图上传需要手动处理请求体（FormData / base64 JSON），不走通用 json() 解析
    // requireAuth 包装器：只有携带有效 Token 的管理员可上传贴纸
    if (pathname === '/api/decos' && method === 'POST') {
        await requireAuth(handleDecoUpload)(req, res);
        return;
    }

    // ---- 认证路由：登录 / 登出 / 当前用户 ----
    // 登录：比对 ADMIN_PASSWORD（从环境变量读取，开发环境回退 'admin123'）
    // 未来升级 bcrypt：将明文比对替换为 bcrypt.compare(password, hash)
    if (pathname === '/api/auth/login' && method === 'POST') {
        try {
            const body = await new Promise((resolve, reject) => {
                let data = '';
                req.on('data', chunk => data += chunk);
                req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({}); } });
                req.on('error', reject);
            });
            const { username, password } = body;
            if (username === 'admin' && password === ADMIN_PASSWORD) {
                const token = generateToken('admin', 'admin');
                const expiresIn = 7 * 24 * 60 * 60; // 7 天，单位秒 — 前端可据此提前提示用户
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token, userId: 'admin', role: 'admin', expiresIn }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '用户名或密码错误' }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '服务器错误' }));
        }
        return;
    }

    // 登出：需携带有效 Token，成功后 Token 失效
    if (pathname === '/api/auth/logout' && method === 'POST') {
        await requireAuth(async (req, res) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader.slice(7); // 去掉 "Bearer "
            revokeToken(token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        })(req, res);
        return;
    }

    // 当前用户信息：需携带有效 Token
    if (pathname === '/api/auth/me' && method === 'GET') {
        await requireAuth(async (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ userId: req.user.userId, role: req.user.role }));
        })(req, res);
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
    const host = process.env.HOST || '127.0.0.1';
    server.listen(PORT, host, () => {
        console.log(`✅ API & WebSocket 服务运行在 http://${host}:${PORT}`);
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
