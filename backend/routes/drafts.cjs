// 文章草稿历史：每次保存草稿追加一条记录（不覆盖），支持预览/恢复/删除。
// 使用 sendBeacon 在页面关闭前自动保存，避免数据丢失。
const { send, json } = require('../enhance.cjs');
const dbModule = require('../db.cjs');
const { broadcast } = require('../websocket.cjs');

function registerDraftsRoutes(GET, POST, PUT, DELETE) {

    GET('/api/articles/:id/drafts', async (req, res) => {
        const articleId = parseInt(req.params.id);
        const rows = dbModule.queryAll(
            'SELECT id, article_id, title, content, category, saved_at FROM article_drafts WHERE article_id = ? ORDER BY saved_at DESC',
            [articleId]
        );
        send(res, rows);
    });

    POST('/api/articles/:id/drafts', async (req, res) => {
        const articleId = parseInt(req.params.id);
        const { title, content, category } = await json(req);
        const now = new Date().toISOString();
        dbModule.run(
            'INSERT INTO article_drafts (article_id, title, content, category, saved_at) VALUES (?, ?, ?, ?, ?)',
            [articleId, title, content, category, now]
        );
        const row = dbModule.query('SELECT last_insert_rowid() as id');
        broadcast({ type: 'draft_saved', payload: { articleId, savedAt: now } });
        send(res, { success: true, savedAt: now, id: row.id });
    });

    DELETE('/api/articles/:id/drafts/:draftId', async (req, res) => {
        const draftId = parseInt(req.params.draftId);
        const existing = dbModule.query('SELECT id FROM article_drafts WHERE id = ?', [draftId]);
        if (!existing) {
            send(res, { error: 'Draft not found' }, 404);
            return;
        }
        dbModule.exec('DELETE FROM article_drafts WHERE id = ?', [draftId]);
        send(res, { success: true });
    });
}

module.exports = { registerDraftsRoutes };