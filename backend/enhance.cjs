// ============================================================
// 极致轻量级 Web 增强层（0 依赖，~60 行）
// 设计哲学：增强而非抽象，保留底层控制力
// ============================================================

/**
 * 统一 JSON 响应
 * @param {http.ServerResponse} res
 * @param {*} data - 任意可序列化数据
 * @param {number} status - HTTP 状态码，默认 200
 */
function send(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

/**
 * 解析 JSON 请求体（Promise 化）
 * @param {http.IncomingMessage} req
 * @returns {Promise<Object>}
 */
function json(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * 极简路由注册器
 * 用法：GET('/api/articles', async (req, res) => { ... })
 */
const routes = { GET: {}, POST: {}, PUT: {}, DELETE: {} };

function register(method, path, handler) {
    routes[method][path] = handler;
}

// 导出便捷方法
const GET = (path, handler) => register('GET', path, handler);
const POST = (path, handler) => register('POST', path, handler);
const PUT = (path, handler) => register('PUT', path, handler);
const DELETE = (path, handler) => register('DELETE', path, handler);

/**
 * 路由匹配器（在 server.cjs 中调用）
 * @param {string} method - 'GET', 'POST', etc.
 * @param {string} pathname
 * @returns {Function|null} 匹配的 handler，或 null
 */
function match(method, pathname) {
    // 精确匹配
    if (routes[method] && routes[method][pathname]) {
        return routes[method][pathname];
    }
    // 参数路由：/api/articles/:id
    for (const routePath of Object.keys(routes[method] || {})) {
        const pattern = routePath.replace(/:[^/]+/g, '([^/]+)');
        const regex = new RegExp(`^${pattern}$`);
        const match = pathname.match(regex);
        if (match) {
            const handler = routes[method][routePath];
            // 注入 params
            return (req, res) => {
                const keys = (routePath.match(/:[^/]+/g) || []).map(k => k.slice(1));
                req.params = {};
                keys.forEach((key, i) => { req.params[key] = match[i + 1]; });
                handler(req, res);
            };
        }
    }
    return null;
}

module.exports = {
    send,
    json,
    GET,
    POST,
    PUT,
    DELETE,
    match,
};