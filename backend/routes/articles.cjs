// 文章 CRUD + 可见性控制。每次写操作后通过 WebSocket broadcast 通知所有客户端刷新。
const { send, json } = require('../enhance.cjs');
const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function registerArticleRoutes(GET, POST, PUT, DELETE) {

    GET('/api/articles', async (req, res) => {
        const rows = dbModule.queryAll('SELECT * FROM articles ORDER BY id');
        send(res, rows);
    });

    POST('/api/articles', async (req, res) => {
        const { title, content, category } = await json(req);
        const now = new Date().toISOString();
        dbModule.run(
            'INSERT INTO articles (title, content, category, updateTime, visible) VALUES (?, ?, ?, ?, 1)',
            [title, content, category || '默认分类', now]
        );
        const row = dbModule.query('SELECT last_insert_rowid() as id');
        const newArticle = {
            id: row.id,
            title,
            content,
            category: category || '默认分类',
            updateTime: now,
            visible: 1,
        };
        broadcast({ type: 'article_created', payload: { article: newArticle } });
        send(res, newArticle, 201);
    });

    PUT('/api/articles/:id', async (req, res) => {
        const id = parseInt(req.params.id);
        const { title, content, category } = await json(req);
        const existing = dbModule.query('SELECT id FROM articles WHERE id = ?', [id]);
        if (!existing) {
            send(res, { error: 'Article not found' }, 404);
            return;
        }
        const now = new Date().toISOString();
        dbModule.exec(
            'UPDATE articles SET title = ?, content = ?, category = ?, updateTime = ? WHERE id = ?',
            [title, content, category || '未分类', now, id]
        );
        broadcast({ type: 'article_updated', payload: { id, title, content, category, updateTime: now } });
        send(res, { success: true });
    });

    DELETE('/api/articles/:id', async (req, res) => {
        const id = parseInt(req.params.id);
        const existing = dbModule.query('SELECT id FROM articles WHERE id = ?', [id]);
        if (!existing) {
            send(res, { error: 'Article not found' }, 404);
            return;
        }
        dbModule.exec('DELETE FROM articles WHERE id = ?', [id]);
        broadcast({ type: 'article_deleted', payload: { id } });
        send(res, { success: true });
    });

    PUT('/api/articles/:id/visibility', async (req, res) => {
        const id = parseInt(req.params.id);
        const { visible } = await json(req);
        const existing = dbModule.query('SELECT id FROM articles WHERE id = ?', [id]);
        if (!existing) {
            send(res, { error: 'Article not found' }, 404);
            return;
        }
        dbModule.exec('UPDATE articles SET visible = ? WHERE id = ?', [visible ? 1 : 0, id]);
        broadcast({ type: 'visibility_changed', payload: { articleId: id, visible: !!visible } });
        send(res, { success: true });
    });
}

module.exports = { registerArticleRoutes };