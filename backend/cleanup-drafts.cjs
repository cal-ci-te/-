// 草稿过期清理：删除 saved_at 超过 30 天的草稿。
// 启动时全量清理 + 每次保存草稿时增量清理，两者共用此函数。
const dbModule = require('./db.cjs');

const MAX_AGE_DAYS = 30;

function cleanExpiredDrafts(articleId) {
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
        let sql, params;
        if (articleId !== undefined && articleId !== null) {
            sql = 'DELETE FROM article_drafts WHERE saved_at < ? AND article_id = ?';
            params = [cutoff, articleId];
        } else {
            sql = 'DELETE FROM article_drafts WHERE saved_at < ?';
            params = [cutoff];
        }
        const result = dbModule.exec(sql, params);
        if (result.changes > 0) {
            console.log('[Cleanup] 删除了', result.changes, '条过期草稿',
                articleId !== undefined ? '(文章 ' + articleId + ')' : '(全量)');
        }
        return result.changes;
    } catch (err) {
        console.error('[Cleanup] 清理失败:', err.message);
        return 0;
    }
}

module.exports = { cleanExpiredDrafts };
