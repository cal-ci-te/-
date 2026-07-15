const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function handleDraftsRoutes(req, res, parsedUrl, method) {
    const pathname = parsedUrl.pathname;
    console.log(`[Drafts] 进入处理函数，pathname: ${pathname}, method: ${method}`);

    // POST
    const postMatch = pathname.match(/^\/api\/articles\/(\d+)\/drafts$/);
    if (postMatch && method === 'POST') {
        const articleId = parseInt(postMatch[1]);
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { title, content, category } = JSON.parse(body);
                const now = new Date().toISOString();
                const db = dbModule.getDb();
                if (!db) {
                    console.error('[Drafts] 数据库未初始化');
                    res.writeHead(500);
                    res.end('Database not initialized');
                    return;
                }
                const stmt = db.prepare(
                    'INSERT INTO article_drafts (article_id, title, content, category, saved_at) VALUES (?, ?, ?, ?, ?)'
                );
                stmt.run([articleId, title, content, category, now]);
                stmt.free();
                dbModule.saveDb();
                const idRows = db.exec('SELECT last_insert_rowid()');
                const newId = idRows[0]?.values?.[0]?.[0] || 0;
                console.log('[Drafts] 新插入草稿ID:', newId);
                broadcast({ type: 'draft_saved', payload: { articleId, savedAt: now } });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, savedAt: now, id: newId }));
            } catch (e) {
                console.error('[Drafts] 保存草稿失败:', e);
                res.writeHead(400);
                res.end('Invalid JSON or insert failed');
            }
        });
        return true;
    }

    // GET
    const getMatch = pathname.match(/^\/api\/articles\/(\d+)\/drafts$/);
    if (getMatch && method === 'GET') {
        const articleId = parseInt(getMatch[1]);
        try {
            const db = dbModule.getDb();
            if (!db) {
                console.error('[Drafts] 数据库未初始化');
                res.writeHead(500);
                res.end('Database not initialized');
                return true;
            }
            const stmt = db.prepare(
                'SELECT id, article_id, title, content, category, saved_at FROM article_drafts WHERE article_id = ? ORDER BY saved_at DESC'
            );
            stmt.bind([articleId]);
            const rows = [];
            while (stmt.step()) {
                const values = stmt.get();
                rows.push({
                    id: values[0],
                    article_id: values[1],
                    title: values[2],
                    content: values[3],
                    category: values[4],
                    saved_at: values[5]
                });
            }
            stmt.free();
            console.log('[Drafts] 查询草稿，文章ID:', articleId, '数量:', rows.length);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rows));
        } catch (e) {
            console.error('[Drafts] 查询草稿失败:', e);
            res.writeHead(500);
            res.end('Database error');
        }
        return true;
    }

    // DELETE
    const deleteMatch = pathname.match(/^\/api\/articles\/\d+\/drafts\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
        const draftId = parseInt(deleteMatch[1]);
        try {
            console.log(`[Drafts] 执行删除，draftId=${draftId}`);
            const db = dbModule.getDb();
            if (!db) {
                console.error('[Drafts] 数据库未初始化');
                res.writeHead(500);
                res.end('Database not initialized');
                return true;
            }
            // 先查询是否存在
            const checkStmt = db.prepare('SELECT article_id FROM article_drafts WHERE id = ?');
            checkStmt.bind([draftId]);
            let actualArticleId = null;
            if (checkStmt.step()) {
                actualArticleId = checkStmt.get()[0];
            }
            checkStmt.free();
            if (actualArticleId === null) {
                console.warn(`[Drafts] 未找到草稿，ID: ${draftId}`);
                res.writeHead(404);
                res.end('Draft not found');
                return true;
            }
            // 执行删除
            const delStmt = db.prepare('DELETE FROM article_drafts WHERE id = ?');
            delStmt.run([draftId]);
            delStmt.free();
            dbModule.saveDb();
            // 重新查询确认是否删除成功
            const verifyStmt = db.prepare('SELECT id FROM article_drafts WHERE id = ?');
            verifyStmt.bind([draftId]);
            const exists = verifyStmt.step();
            verifyStmt.free();
            if (!exists) {
                console.log(`[Drafts] 删除草稿成功，ID: ${draftId}, 所属文章ID: ${actualArticleId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                console.warn(`[Drafts] 删除后仍存在草稿，ID: ${draftId}`);
                res.writeHead(500);
                res.end('Delete failed');
            }
        } catch (e) {
            console.error('[Drafts] 删除草稿异常:', e);
            console.error(e.stack);
            res.writeHead(500);
            res.end('Database error');
        }
        return true;
    }

    return false;
}

module.exports = handleDraftsRoutes;