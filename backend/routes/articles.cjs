const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function handleArticlesRoutes(req, res, parsedUrl, method) {
    // 去除尾部斜杠，避免匹配失败
    const pathname = parsedUrl.pathname.replace(/\/+$/, '');
    console.log(`[articles] pathname: ${pathname}, method: ${method}`);

    // ===== GET /api/articles =====
    if (pathname === '/api/articles' && method === 'GET') {
        try {
            const rows = dbModule.queryAll('SELECT * FROM articles ORDER BY id');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rows));
        } catch (err) {
            console.error('[DB] 查询文章失败:', err);
            res.writeHead(500);
            res.end('Database error');
        }
        return true;
    }

    // ===== POST /api/articles =====
    if (pathname === '/api/articles' && method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const { title, content, category } = JSON.parse(body);
                const now = new Date().toISOString();
                dbModule.run(
                    'INSERT INTO articles (title, content, category, updateTime, visible) VALUES (?, ?, ?, ?, 1)',
                    [title, content, category || '默认分类', now]
                );
                const row = dbModule.query('SELECT last_insert_rowid() as id');
                const newId = row ? row.id : 0;
                const newArticle = {
                    id: newId,
                    title,
                    content,
                    category: category || '默认分类',
                    updateTime: now,
                    visible: 1,
                };
                broadcast({ type: 'article_created', payload: { article: newArticle } });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newArticle));
            } catch (e) {
                console.error(e);
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return true;
    }

    // ===== PUT /api/articles/:id/visibility =====
    if (pathname.startsWith('/api/articles/') && pathname.endsWith('/visibility') && method === 'PUT') {
        const idPart = pathname.slice('/api/articles/'.length, -'/visibility'.length);
        const id = parseInt(idPart);
        if (isNaN(id)) {
            res.writeHead(400);
            res.end('Invalid article ID');
            return true;
        }
        console.log(`[visibility] 收到请求，ID=${id}`);
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const { visible } = JSON.parse(body);
                console.log(`[visibility] 设置 visible=${visible}`);

                // 先检查文章是否存在
                const existing = dbModule.query('SELECT id FROM articles WHERE id = ?', [id]);
                if (!existing) {
                    console.log(`[visibility] 文章 ID=${id} 不存在`);
                    res.writeHead(404);
                    res.end('Article not found');
                    return;
                }

                // 执行更新
                const result = dbModule.exec('UPDATE articles SET visible = ? WHERE id = ?', [
                    visible ? 1 : 0,
                    id,
                ]);
                console.log(`[visibility] exec 结果:`, result);

                if (result.changes === 0) {
                    console.log(`[visibility] 更新行数为 0，可能未发生变化，但文章存在，视为成功`);
                    // 即使 changes 为 0，也可能是因为 visible 值未变，我们仍视为成功
                }

                broadcast({
                    type: 'visibility_changed',
                    payload: { articleId: id, visible: !!visible },
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('[visibility] 错误:', e);
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return true;
    }

    // ===== PUT /api/articles/:id (完整更新) =====
    if (pathname.startsWith('/api/articles/') && method === 'PUT' && !pathname.endsWith('/visibility')) {
        const idPart = pathname.slice('/api/articles/'.length);
        const id = parseInt(idPart);
        if (isNaN(id)) {
            res.writeHead(400);
            res.end('Invalid article ID');
            return true;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const { title, content, category } = JSON.parse(body);
                const existing = dbModule.query('SELECT id FROM articles WHERE id = ?', [id]);
                if (!existing) {
                    res.writeHead(404);
                    res.end('Article not found');
                    return;
                }
                const now = new Date().toISOString();
                const result = dbModule.exec(
                    'UPDATE articles SET title = ?, content = ?, category = ?, updateTime = ? WHERE id = ?',
                    [title, content, category || '未分类', now, id]
                );
                broadcast({
                    type: 'article_updated',
                    payload: { id, title, content, category, updateTime: now },
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, changes: result.changes }));
            } catch (e) {
                console.error(e);
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return true;
    }

    // ===== DELETE /api/articles/:id =====
    if (pathname.startsWith('/api/articles/') && method === 'DELETE') {
        const idPart = pathname.slice('/api/articles/'.length);
        const id = parseInt(idPart);
        if (isNaN(id)) {
            res.writeHead(400);
            res.end('Invalid article ID');
            return true;
        }
        console.log(`[DELETE] 收到删除请求，ID=${id}`);
        try {
            const existing = dbModule.query('SELECT id FROM articles WHERE id = ?', [id]);
            if (!existing) {
                console.log(`[DELETE] 文章不存在，返回 404`);
                res.writeHead(404);
                res.end('Article not found');
                return true;
            }
            const result = dbModule.exec('DELETE FROM articles WHERE id = ?', [id]);
            console.log(`[DELETE] exec 结果:`, result);
            broadcast({ type: 'article_deleted', payload: { id } });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return true;
        } catch (err) {
            console.error('[DELETE] 删除文章失败:', err);
            res.writeHead(500);
            res.end('Database error');
            return true;
        }
    }

    // 不匹配
    return false;
}

module.exports = handleArticlesRoutes;