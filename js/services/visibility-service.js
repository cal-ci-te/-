// ========== 可见性服务 ==========
import { AppState } from '../core/app-state.js';
import { ArticleService } from './article-service.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { NotificationService } from './notification-service.js';

export const VisibilityService = {
  // ----- 检查是否有权限修改 -----
  canModify() {
    return AppState.get('isLoggedIn') === true;
  },

  // ----- 判断单篇文章是否可见（管理员始终可见） -----
  isVisible(articleId, articles) {
    if (this.canModify()) return true;
    const article = (articles || []).find((a) => a.id === articleId);
    return article ? article.visible !== false : false;
  },

  // ----- 获取可见文章列表 -----
  getVisibleArticles(articles) {
    if (this.canModify()) return articles.slice();
    return articles.filter((a) => a.visible !== false);
  },

  // ----- 切换可见性（调用 ArticleService.setVisibility） -----
  async toggleVisibility(articleId, articles, setVisibilityFn) {
    if (!this.canModify()) {
      NotificationService.showToast(NotificationService.messages.visibilityAdminOnly, true);
      return false;
    }
    const article = (articles || []).find((a) => a.id === articleId);
    if (!article) return false;

    const newVisible = !article.visible;
    if (typeof setVisibilityFn === 'function') {
      return await setVisibilityFn(articleId, newVisible);
    } else if (typeof ArticleService !== 'undefined' && ArticleService.setVisibility) {
      return await ArticleService.setVisibility(articleId, newVisible);
    } else {
      // 降级：直接修改本地数据（模拟）
      article.visible = newVisible;
      EventBus.emit(EVENTS.ARTICLE_VISIBILITY_CHANGED, {
        articleId,
        visible: newVisible,
        fromRemote: false,
      });
      NotificationService.showVisibilityChanged(newVisible);
      return true;
    }
  },

  // ----- 判断当前用户是否为管理员（与 canModify 相同） -----
  isAdmin() {
    return this.canModify();
  },
};

console.log('✅ VisibilityService 已加载 (ES Module)');
