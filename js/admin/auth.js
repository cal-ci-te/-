// 管理员认证模块。v1.10 将登录验证从本地 CONFIG 比对迁移至后端 Token 认证：
//   登录 → POST /api/auth/login 获取 Token 存入 localStorage
//   登出 → POST /api/auth/logout 使 Token 失效并清除本地状态
//   状态恢复 → 检查 localStorage 中是否有 auth_token，有则视为已登录
import { Utils } from '../utils.js';
import { AppState } from '../core/app-state.js';
import { MUTATIONS } from '../core/state-mutations.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { ApiClient } from '../services/api-client.js';
import { AdminAvatar } from './avatar.js';
import { AdminPosition } from './position.js';
import { AdminUI } from './ui.js';
import { AdminEvents } from './events/index.js';
import { DecoShelf } from '../services/deco.js';
import { DecoEdit } from '../services/deco-edit.js';
import { DOMRefs } from '../core/dom-refs.js';
import { UI } from '../utils/ui-strings.js';

export const AdminAuth = {
  /** 页面加载时恢复登录状态：检查 localStorage 中是否有 auth_token */
  checkStatus: function () {
    console.log('[AdminAuth] 检查登录状态...');
    const token = localStorage.getItem('auth_token');
    const savedAvatar = AdminAvatar.getAvatarForUser();

    AdminPosition.loadPosition();
    AdminPosition.applyPosition();
    AdminPosition.applyCollapsedState();

    if (token) {
      // 有 Token → 视为已登录（真实有效性由后端在每次请求时校验）
      // 同时清理旧版 admin_logged_in 标记（v1.9 → v1.10 迁移）
      localStorage.removeItem('admin_logged_in');
      AppState.commit(MUTATIONS.SET_LOGGED_IN, true);
      if (savedAvatar) {
        AdminAvatar.setAvatarImage(savedAvatar);
      }
      AdminUI.showPanel();
      EventBus.emit(EVENTS.AUTH_LOGGED_IN);
      setTimeout(function () {
        if (AdminEvents) { AdminEvents.rebind(); }
      }, 200);
      console.log('[AdminAuth] 已登录（Token 有效待后端校验）');
    } else {
      AppState.commit(MUTATIONS.SET_LOGGED_IN, false);
      AdminUI.hidePanel();
      EventBus.emit(EVENTS.AUTH_LOGGED_OUT);
      console.log('[AdminAuth] 未登录');
    }
  },

  /** 登录：调用后端 API 验证凭据，成功后存储 Token */
  login: async function (username, password) {
    console.log('[AdminAuth] 登录请求 → POST /api/auth/login');
    try {
      const result = await ApiClient.post('/api/auth/login', { username, password });
      // result: { token, userId, role: 'admin' }
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_role', result.role);
      // 清理旧版标记（v1.9 残留）
      localStorage.removeItem('admin_logged_in');

      AppState.commit(MUTATIONS.SET_LOGGED_IN, true);

      const savedAvatar = AdminAvatar.getAvatarForUser();
      if (savedAvatar) { AdminAvatar.setAvatarImage(savedAvatar); }

      Utils.showToast(UI.notification.loginSuccess, false);
      AdminUI.showPanel();

      setTimeout(function () {
        if (AdminEvents) { AdminEvents.rebind(); }
      }, 200);

      const modal = DOMRefs.get(DOMRefs.login.modal);
      if (modal) modal.classList.remove('active');
      const usernameInput = DOMRefs.get(DOMRefs.login.username);
      const passwordInput = DOMRefs.get(DOMRefs.login.password);
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';

      EventBus.emit(EVENTS.AUTH_LOGGED_IN);
      console.log('[AdminAuth] 登录成功，Token 已存储');
      return true;
    } catch (error) {
      // 401 或网络错误均视为登录失败
      Utils.showToast(UI.toast.loginFailed, true);
      console.log('[AdminAuth] 登录失败:', error.message);
      return false;
    }
  },

  /** 登出：通知后端使 Token 失效，清除本地状态 */
  logout: async function () {
    console.log('[AdminAuth] 登出...');
    if (DecoShelf && DecoShelf.isEditing) {
      if (typeof DecoShelf.cancelEditing === 'function') {
        DecoShelf.cancelEditing();
      }
    }
    if (DecoEdit && DecoEdit.isActive()) {
      DecoEdit.exitEditMode(false);
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      // 尝试通知后端撤销 Token（网络失败不阻塞本地清理）
      try { await ApiClient.post('/api/auth/logout', {}); } catch (e) { /* ignore */ }
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    AppState.commit(MUTATIONS.SET_LOGGED_IN, false);
    AdminUI.hidePanel();
    Utils.showToast(UI.notification.logoutSuccess, false);
    EventBus.emit(EVENTS.AUTH_LOGGED_OUT);
    console.log('[AdminAuth] 已登出');
  },
};

