// ========== 待提交移动操作管理 ==========
import { ArticleService } from '../../../services/article-service.js';
import { Utils } from '../../../utils.js';

export function createPendingMovesManager() {
    let pendingMoves = [];

    function recordMove(articleId, newCategory) {
        pendingMoves.push({ articleId, newCategory });
        console.log('[PendingMoves] 记录移动操作:', articleId, '->', newCategory);
    }

    function clearMoves() {
        if (pendingMoves.length > 0) {
            console.log('[PendingMoves] 清空待处理移动操作，共', pendingMoves.length, '项');
            pendingMoves = [];
        }
    }

    async function commitMoves(updateTreeFn) {
        if (pendingMoves.length === 0) {
            console.log('[PendingMoves] 无待提交的移动操作');
            return;
        }
        console.log('[PendingMoves] 提交移动操作，共', pendingMoves.length, '项');
        const moves = [...pendingMoves];
        pendingMoves = [];
        let hasError = false;

        for (const move of moves) {
            try {
                const article = ArticleService.getArticle(move.articleId);
                if (!article) {
                    console.warn('[PendingMoves] 文章不存在，跳过:', move.articleId);
                    continue;
                }
                const response = await fetch('/api/articles/' + move.articleId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: article.title,
                        content: article.content,
                        category: move.newCategory
                    })
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                console.log('[PendingMoves] 提交成功:', move.articleId);
            } catch (err) {
                console.error('[PendingMoves] 提交移动失败:', move.articleId, err);
                Utils.showToast('保存位置变更失败: ' + err.message, true);
                hasError = true;
            }
        }

        await ArticleService.fetchArticles(true);
        if (updateTreeFn) updateTreeFn();
        if (!hasError) {
            Utils.showToast('位置更改已保存', false);
        } else {
            Utils.showToast('部分位置变更保存失败，请检查网络后重试', true);
        }
    }

    function getPendingMoves() {
        return pendingMoves.slice();
    }

    return {
        recordMove,
        clearMoves,
        commitMoves,
        getPendingMoves,
    };
}