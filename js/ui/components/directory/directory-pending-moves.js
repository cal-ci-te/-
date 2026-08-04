import { ArticleService } from '../../../services/article-service.js';
import { ApiClient } from '../../../services/api-client.js';
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
                const articles = ArticleService.getAllArticles();
                const article = articles.find(a => a.id === move.articleId);
                if (!article) {
                    console.warn('[PendingMoves] 文章不存在，跳过:', move.articleId);
                    continue;
                }
                await ApiClient.put('/api/articles/' + move.articleId, {
                    title: article.title,
                    content: article.content,
                    category: move.newCategory
                });
                console.log('[PendingMoves] 提交成功:', move.articleId);
            } catch (err) {
                console.error('[PendingMoves] 提交移动失败:', move.articleId, err);
                Utils.showToast(UI.toast.positionModeSaveError(err.message), true);
                hasError = true;
            }
        }

        await ArticleService.fetchArticles(true);
        if (updateTreeFn) updateTreeFn();
        if (!hasError) {
            Utils.showToast(UI.toast.positionModeSaved, false);
        } else {
            Utils.showToast(UI.toast.positionModeSavePartialError, true);
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