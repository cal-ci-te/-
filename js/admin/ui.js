import { DOMRefs } from '../core/dom-refs.js';
import { AdminPosition } from './position.js';
import { AdminDrag } from './drag.js';
import { AdminPanel } from './panel/index.js';
import { AdminEvents } from './events/index.js';
import { UIController } from '../ui/ui-controller.js';
import { Utils } from '../utils.js';

export const AdminUI = {
  updateLoginUI: function (isLoggedIn) {
    const loginLabel = DOMRefs.get(DOMRefs.login.label);
    const welcomeText = DOMRefs.get(DOMRefs.login.welcomeText);
    const loginAvatar = DOMRefs.get(DOMRefs.login.avatar);

    if (isLoggedIn) {
      if (loginLabel) loginLabel.textContent = '管理员';
      if (welcomeText) welcomeText.textContent = '欢迎管理员';
    } else {
      if (loginLabel) loginLabel.textContent = '登录';
      if (welcomeText) welcomeText.textContent = '欢迎访客';
      if (loginAvatar) loginAvatar.src = 'images/default-avatar.png';
    }
  },

  updateAvatarDisplay: function (dataUrl) {
    const loginAvatar = DOMRefs.get(DOMRefs.login.avatar);
    if (loginAvatar && dataUrl) {
      loginAvatar.src = dataUrl;
    }
    const adminPreview = DOMRefs.get(DOMRefs.adminControls.adminAvatarPreview);
    if (adminPreview && dataUrl) {
      adminPreview.src = dataUrl;
    }
  },

  showPanel: function () {
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    if (!panel) {
      console.warn('[AdminUI] adminPanel 元素不存在');
      return;
    }

    console.log('[AdminUI] 显示面板，开始渲染...');

    if (typeof AdminEvents !== 'undefined') {
      AdminEvents.unbindEvents();
    }

    panel.classList.remove('hidden');
    panel.classList.add('open');
    panel.style.display = 'block';
    AdminPosition.applyPosition();
    AdminPosition.applyCollapsedState();
    AdminDrag.initDrag();

    if (AdminPanel && AdminPanel.renderContent) {
      AdminPanel.renderContent();
      console.log('[AdminUI] renderContent 执行完成');
    } else {
      console.error('[AdminUI] AdminPanel.renderContent 不存在');
    }

    if (AdminPanel && AdminPanel._bindToggleIconDirect) {
      AdminPanel._bindToggleIconDirect();
      console.log('[AdminUI] 直接绑定折叠按钮完成');
    }

    setTimeout(function () {
      if (AdminEvents && AdminEvents.rebind) {
        AdminEvents.rebind();
        console.log('[AdminUI] AdminEvents.rebind 执行完成');
      }
    }, 100);

    setTimeout(function () {
      if (AdminPanel && AdminPanel._bindToggleIconDirect) {
        AdminPanel._bindToggleIconDirect();
        console.log('[AdminUI] 折叠按钮再次绑定（延迟）');
      }
    }, 300);

    // 刷新文章可见性列表（通过 UIController）
    setTimeout(function () {
      if (UIController && typeof UIController.refreshDisplay === 'function') {
        try {
          UIController.refreshDisplay();
        } catch (e) {
          console.warn('[AdminUI] 刷新可见性列表失败:', e);
        }
      }
    }, 300);

    console.log('[AdminUI] 面板已显示');
  },

  hidePanel: function () {
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    if (!panel) return;
    if (AdminEvents) {
      AdminEvents.unbindEvents();
    }
    panel.classList.add('hidden');
    panel.style.display = 'none';
    console.log('[AdminUI] 面板已隐藏');
  },

  togglePanel: function () {
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    if (!panel) return;
    if (panel.classList.contains('hidden') || panel.style.display === 'none') {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  },

  showToast: function (message, isError) {
    Utils.showToast(message, isError);
  },

  updatePanelAvatar: function (avatarUrl) {
    const adminPreview = DOMRefs.get(DOMRefs.adminControls.adminAvatarPreview);
    if (adminPreview && avatarUrl) {
      adminPreview.src = avatarUrl;
    }
  },
};

