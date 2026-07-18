import { AppState } from '../core/app-state.js';
import { ArticleService } from './article-service.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { NotificationService } from './notification-service.js';

export const VisibilityService = {
  canModify() {
    return AppState.get('isLoggedIn') === true;
  },

  isVisible(articleId, articles) {
    if (this.canModify()) return true;
    const article = (articles || []).find((a) => a.id === articleId);
    return article ? article.visible !== false : false;
  },

  getVisibleArticles(articles) {
    if (this.canModify()) return articles.slice();
    return articles.filter((a) => a.visible !== false);
  },

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

  isAdmin() {
    return this.canModify();
  },
};

