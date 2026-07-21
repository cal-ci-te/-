import { AppState } from '../core/app-state.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { Utils } from '../utils.js';

import { AdminAuth } from './auth.js';
import { AdminUI } from './ui.js';
import { AdminPosition } from './position.js';
import { AdminAvatar } from './avatar.js';
import { AdminEvents } from './events/index.js';

import { Texture } from '../services/texture.js';
import { Watermark } from '../services/watermark.js';
import { DecoShelf } from '../services/deco.js'; // 移除未使用的 Deco
import { Article } from '../models/article-model.js';
import { UIController } from '../ui/ui-controller.js';

console.log('[Admin] 开始组装模块...');

AppState.subscribe('isLoggedIn', function (_newValue) {
  // 参数改用下划线
  AdminUI.updateLoginUI(_newValue);
  if (_newValue) {
    AdminUI.showPanel();
  } else {
    AdminUI.hidePanel();
  }
}).subscribe('panelCollapsed', function (newValue) {
  AdminPosition.applyCollapsedState();
});

EventBus
  // --- 头像 ---
  .on(EVENTS.ADMIN_AVATAR_UPLOAD, function () {
    AdminAvatar.openUpload();
  })

  // --- 背景颜色 ---
  .on(EVENTS.ADMIN_BG_COLOR_APPLY, function (data) {
    Texture.setBgColor(data.color);
    Utils.showToast(UI.toast.adminBgColorApplied, false);
    Utils.storage.set('bg_color', data.color);
  })
  .on(EVENTS.ADMIN_BG_COLOR_RESET, function () {
    Texture.resetBgColor();
    const picker = document.getElementById('bgColorPicker');
    const preview = document.getElementById('bgColorPreview');
    if (picker) picker.value = '#1a1612'; // → var(--color-bg-primary), color picker 需 hex
    if (preview) preview.style.backgroundColor = '#1a1612'; // → var(--color-bg-primary)
    Utils.showToast(UI.toast.adminBgColorReset, false);
  })

  // --- 纹理 ---
  .on(EVENTS.ADMIN_TEXTURE_UPLOAD, function (data) {
    Texture.uploadTexture(data.file);
  })
  .on(EVENTS.ADMIN_TEXTURE_APPLY, function () {
    if (!Texture.textureConfig || !Texture.textureConfig.dataUrl) {
      Utils.showToast(UI.toast.adminTextureUploadFirst, true);

      return;
    }
    Texture.saveConfig();
    Utils.showToast(UI.toast.adminTextureSaved, false);
  })
  .on(EVENTS.ADMIN_TEXTURE_RESET, function () {
    Texture.removeTexture();
    Utils.showToast(UI.toast.adminTextureRemoved, false);
  })
  .on(EVENTS.ADMIN_TEXTURE_OPACITY_CHANGE, function (data) {
    Texture.setOpacity(data.opacity);
  })

  // --- 水印 ---
  .on(EVENTS.ADMIN_WATERMARK_APPLY, function (data) {
    Watermark.apply(data.text, data.opacity);
    Utils.showToast(UI.toast.adminWatermarkApplied, false);
  })

  // --- 文件夹过滤（文章列表更新） ---
  .on(EVENTS.ADMIN_FOLDER_FILTER_CHANGE, function () {
    // 删除未使用的 data 参数
    if (UIController && Article && Article.allArticles) {
      const categories = Article.buildDirectoryTree(Article.allArticles);
      UIController.updateArticleListPanel(Article.allArticles, categories);
      Utils.showToast(UI.toast.adminArticleListUpdated, false);
    }
  })

  // --- 退出登录 ---
  .on(EVENTS.ADMIN_LOGOUT, function () {
    AdminAuth.logout();
  })

  // --- 面板折叠切换 ---
  .on(EVENTS.ADMIN_PANEL_TOGGLE, function () {
    AdminPosition.toggleCollapse();
  })

  // --- 确认/取消编辑贴图位置 ---
  .on(EVENTS.ADMIN_CONFIRM_EDIT_POS, function () {
    DecoShelf.confirmEditing();
  })
  .on(EVENTS.ADMIN_CANCEL_EDIT_POS, function () {
    DecoShelf.cancelEditing();
  });

export const Admin = {
  state: AppState,

  checkStatus: AdminAuth.checkStatus,
  login: AdminAuth.login,
  logout: AdminAuth.logout,

  showPanel: AdminUI.showPanel,
  hidePanel: AdminUI.hidePanel,
  togglePanel: AdminUI.togglePanel,
  togglePanelCollapse: AdminPosition.toggleCollapse,

  openAvatarUpload: AdminAvatar.openUpload,
  confirmCrop: AdminAvatar.confirmCrop,
  cancelCrop: AdminAvatar.cancelCrop,
  setAvatarImage: AdminAvatar.setAvatarImage,
  getAvatarForUser: AdminAvatar.getAvatarForUser,

  showToastMessage: Utils.showToast,

  rebindEvents: function () {
    if (AdminEvents && typeof AdminEvents.rebind === 'function') {
      AdminEvents.rebind();
    }
  },

  get isLoggedIn() {
    return AppState.get('isLoggedIn');
  },
  get panelCollapsed() {
    return AppState.get('panelCollapsed');
  },
};

