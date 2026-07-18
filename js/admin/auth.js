import { Utils } from '../utils.js';
import { CONFIG } from '../config.js';
import { AdminAvatar } from './avatar.js';
import { AdminPosition } from './position.js';
import { AdminUI } from './ui.js';
import { AppState } from '../core/app-state.js';
import { MUTATIONS } from '../core/state-mutations.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { AdminEvents } from './events/index.js';
import { DecoShelf } from '../services/deco.js';
// 注意：DOMRefs 在 login 方法中被使用，需要导入
import { DOMRefs } from '../core/dom-refs.js';
// [新增] 导入 UI 文案
import { UI } from '../utils/ui-strings.js';

export const AdminAuth = {
  checkStatus: function () {
    console.log('[AdminAuth] 检查登录状态...');
    const saved = Utils.storage.get('admin_logged_in');
    const savedAvatar = AdminAvatar.getAvatarForUser();

    AdminPosition.loadPosition();
    AdminPosition.applyPosition();
    AdminPosition.applyCollapsedState();

    if (saved === true) {
      AppState.commit(MUTATIONS.SET_LOGGED_IN, true);
      if (savedAvatar) {
        AdminAvatar.setAvatarImage(savedAvatar);
      }
      AdminUI.showPanel();
      EventBus.emit(EVENTS.AUTH_LOGGED_IN);
      setTimeout(function () {
        if (AdminEvents) {
          AdminEvents.rebind();
        }
      }, 200);
      console.log('[AdminAuth] 已登录');
    } else {
      AppState.commit(MUTATIONS.SET_LOGGED_IN, false);
      AdminUI.hidePanel();
      EventBus.emit(EVENTS.AUTH_LOGGED_OUT);
      console.log('[AdminAuth] 未登录');
    }
  },

  login: function (username, password) {
    console.log('[AdminAuth] 登录尝试...');
    if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
      AppState.commit(MUTATIONS.SET_LOGGED_IN, true);
      Utils.storage.set('admin_logged_in', true);

      const savedAvatar = AdminAvatar.getAvatarForUser();
      if (savedAvatar) {
        AdminAvatar.setAvatarImage(savedAvatar);
      }

      // [修改] 使用 UI 文案
      Utils.showToast(UI.notification.loginSuccess, false);
      AdminUI.showPanel();

      setTimeout(function () {
        if (AdminEvents) {
          AdminEvents.rebind();
        }
      }, 200);

      const modal = DOMRefs.get(DOMRefs.login.modal);
      if (modal) modal.classList.remove('active');
      const usernameInput = DOMRefs.get(DOMRefs.login.username);
      const passwordInput = DOMRefs.get(DOMRefs.login.password);
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';

      EventBus.emit(EVENTS.AUTH_LOGGED_IN);
      console.log('[AdminAuth] 登录成功');
      return true;
    } else {
      // [修改] 使用 UI 文案
      Utils.showToast(UI.toast.loginFailed, true);
      console.log('[AdminAuth] 登录失败');
      return false;
    }
  },

  logout: function () {
    console.log('[AdminAuth] 登出...');
    if (DecoShelf && DecoShelf.isEditing) {
      if (typeof DecoShelf.cancelEditing === 'function') {
        DecoShelf.cancelEditing();
      }
    }
    AppState.commit(MUTATIONS.SET_LOGGED_IN, false);
    Utils.storage.set('admin_logged_in', false);
    AdminUI.hidePanel();
    // [修改] 使用 UI 文案
    Utils.showToast(UI.notification.logoutSuccess, false);
    EventBus.emit(EVENTS.AUTH_LOGGED_OUT);
    console.log('[AdminAuth] 已登出');
  },
};

