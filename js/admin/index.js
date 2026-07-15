// ========== 管理员主入口（聚合所有子模块，注册全局状态与事件） ==========
import { AppState } from '../core/app-state.js';
import { EventBus } from '../core/event-bus.js';
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

// ===== 1. 注册全局状态订阅 =====
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

// ===== 2. 注册全局事件监听（EventBus） =====
EventBus
  // --- 头像 ---
  .on('admin:avatar-upload', function () {
    AdminAvatar.openUpload();
  })

  // --- 背景颜色 ---
  .on('admin:bg-color-apply', function (data) {
    Texture.setBgColor(data.color);
    Utils.showToast('背景颜色已应用', false);
    Utils.storage.set('bg_color', data.color);
  })
  .on('admin:bg-color-reset', function () {
    Texture.resetBgColor();
    const picker = document.getElementById('bgColorPicker');
    const preview = document.getElementById('bgColorPreview');
    if (picker) picker.value = '#1a1612';
    if (preview) preview.style.backgroundColor = '#1a1612';
    Utils.showToast('背景颜色已重置', false);
  })

  // --- 纹理 ---
  .on('admin:texture-upload', function (data) {
    Texture.uploadTexture(data.file);
  })
  .on('admin:texture-apply', function () {
    if (!Texture.textureConfig || !Texture.textureConfig.dataUrl) {
      Utils.showToast('请先上传纹理图片', true);
      return;
    }
    Texture.saveConfig();
    Utils.showToast('纹理配置已保存', false);
  })
  .on('admin:texture-reset', function () {
    Texture.removeTexture();
    Utils.showToast('纹理已移除', false);
  })
  .on('admin:texture-opacity-change', function (data) {
    Texture.setOpacity(data.opacity);
  })

  // --- 水印 ---
  .on('admin:watermark-apply', function (data) {
    Watermark.apply(data.text, data.opacity);
    Utils.showToast('水印设置已应用', false);
  })

  // --- 文件夹过滤（文章列表更新） ---
  .on('admin:folder-filter-change', function () {
    // 删除未使用的 data 参数
    if (UIController && Article && Article.allArticles) {
      const categories = Article.buildDirectoryTree(Article.allArticles);
      UIController.updateArticleListPanel(Article.allArticles, categories);
      Utils.showToast('文章列表已更新', false);
    }
  })

  // --- 退出登录 ---
  .on('admin:logout', function () {
    AdminAuth.logout();
  })

  // --- 面板折叠切换 ---
  .on('admin:panel-toggle', function () {
    AdminPosition.toggleCollapse();
  })

  // --- 确认/取消编辑贴图位置 ---
  .on('admin:confirm-edit-pos', function () {
    DecoShelf.confirmEditing();
  })
  .on('admin:cancel-edit-pos', function () {
    DecoShelf.cancelEditing();
  });

// ===== 3. 定义并导出 Admin 主对象 =====
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

console.log('✅ Admin 模块已加载 (ES Module)');
