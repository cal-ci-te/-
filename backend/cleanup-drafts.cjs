// 草稿过期清理：删除 saved_at 超过 30 天的草稿。
// 数量限制：每文章最多 20 条草稿，启动时 + 每次保存时强制执行。
const dbModule = require('./db.cjs');

const MAX_AGE_DAYS = 30;
const MAX_PER_ARTICLE = 20;

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

function enforceDraftLimit(articleId) {
    try {
        if (articleId !== undefined && articleId !== null) {
            const row = dbModule.query(
                'SELECT COUNT(*) as cnt FROM article_drafts WHERE article_id = ?', [articleId]
            );
            if (row && row.cnt > MAX_PER_ARTICLE) {
                const excess = row.cnt - MAX_PER_ARTICLE;
                const result = dbModule.exec(
                    'DELETE FROM article_drafts WHERE id IN (SELECT id FROM article_drafts WHERE article_id = ? ORDER BY saved_at ASC LIMIT ?)',
                    [articleId, excess]
                );
                if (result.changes > 0) {
                    console.log('[Cleanup] 文章', articleId, '超出限制，删除了', result.changes, '条旧草稿');
                }
                return result.changes;
            }
        } else {
            // 全量：遍历所有超限文章
            const rows = dbModule.queryAll(
                'SELECT article_id, COUNT(*) as cnt FROM article_drafts GROUP BY article_id HAVING cnt > ?',
                [MAX_PER_ARTICLE]
            );
            let total = 0;
            rows.forEach(r => {
                total += enforceDraftLimit(r.article_id);
            });
            return total;
        }
    } catch (err) {
        console.error('[Cleanup] 数量限制执行失败:', err.message);
        return 0;
    }
    return 0;
}

module.exports = { cleanExpiredDrafts, enforceDraftLimit };
