// 自研路由/响应增强层，零依赖。
// 项目仅 ~15 个 REST 端点，引入 Express 的收益不足以抵消其概念开销。
// 使用原生 http + 正则路由匹配，保留底层控制力。
// 若以后 API 增长至 50+，可无缝迁移至 Express 的 app.get('/api/articles/:id', ...) 模式。

function send(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

function json(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (err) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

const routes = { GET: {}, POST: {}, PUT: {}, DELETE: {} };

function register(method, path, handler) {
    routes[method][path] = handler;
}

const GET    = (path, handler) => register('GET', path, handler);
const POST   = (path, handler) => register('POST', path, handler);
const PUT    = (path, handler) => register('PUT', path, handler);
const DELETE = (path, handler) => register('DELETE', path, handler);

// 路由匹配：先精确匹配，再尝试 /api/articles/:id 参数路由
function match(method, pathname) {
    if (routes[method] && routes[method][pathname]) {
        return routes[method][pathname];
    }
    for (const routePath of Object.keys(routes[method] || {})) {
        const pattern = routePath.replace(/:[^/]+/g, '([^/]+)');
        const regex = new RegExp(`^${pattern}$`);
        const matchResult = pathname.match(regex);
        if (matchResult) {
            const handler = routes[method][routePath];
            const keys = (routePath.match(/:[^/]+/g) || []).map(k => k.slice(1));
            return (req, res) => {
                req.params = {};
                keys.forEach((key, i) => { req.params[key] = matchResult[i + 1]; });
                handler(req, res);
            };
        }
    }
    return null;
}

module.exports = { send, json, GET, POST, PUT, DELETE, match, routes };
