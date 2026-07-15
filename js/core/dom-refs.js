// ========== DOM 引用配置 ==========
export const DOMRefs = {
  // ===== 侧边栏 =====
  sidebar: {
    container: '#sidebar',
    toggleBtn: '#sidebarCollapseBtn',
    searchInput: '#sidebarSearchInput',
    directoryTree: '#directoryTree',
    overlay: '#sidebarOverlay',
  },

  // ===== 文章列表 =====
  articles: {
    container: '#articlesContainer',
  },

  // ===== 详情页 =====
  detail: {
    overlay: '#detailOverlay',
    content: '#detailContent',
    closeBtn: '#detailCloseBtn',
    body: '#detailBody',
  },

  // ===== 登录 =====
  login: {
    widget: '#loginWidget',
    trigger: '#loginTrigger',
    avatar: '#loginAvatar',
    label: '.login-label',
    welcomeText: '#welcomeText',
    modal: '#loginModalOverlay',
    closeBtn: '#modalCloseBtn',
    loginBtn: '#modalLoginBtn',
    username: '#loginUsername',
    password: '#loginPassword',
  },

  // ===== 头像裁剪 =====
  crop: {
    overlay: '#avatarCropModalOverlay',
    canvas: '#cropCanvas',
    previewCanvas: '#previewCanvas',
    confirmBtn: '#cropConfirmBtn',
    cancelBtn: '#cropCancelBtn',
    closeBtn: '#cropModalCloseBtn',
  },

  // ===== 管理员面板 =====
  admin: {
    panel: '#adminPanel',
    header: '#panelHeader',
    content: '#panelContent',
    toggleIcon: '#panelToggleIcon',
  },

  // ===== 管理员控制按钮 =====
  adminControls: {
    toggleDecoEdit: '#toggleDecoEditBtn',
    decoEditStatus: '#decoEditStatus',
    resetDecoLogo: '#resetDecoLogoBtn',
    resetDecoStamp: '#resetDecoStampBtn',
    resetDecoRaven: '#resetDecoRavenBtn',
    uploadAvatar: '#uploadAvatarBtn',
    adminAvatarPreview: '#adminAvatarPreview',
    bgColorPicker: '#bgColorPicker',
    bgColorPreview: '#bgColorPreview',
    applyBgColor: '#applyBgColorBtn',
    resetBgColor: '#resetBgColorBtn',
    textureUpload: '#textureUpload',
    texturePreview: '#texturePreview',
    applyTexture: '#applyTextureBtn',
    resetTexture: '#resetTextureBtn',
    textureOpacitySlider: '#textureOpacitySlider',
    textureOpacityValue: '#textureOpacityValue',
    watermarkText: '#watermarkTextInput',
    watermarkOpacitySlider: '#watermarkOpacitySlider',
    opacityValue: '#opacityValue',
    applyWatermark: '#applyWatermarkBtn',
    folderFilter: '#folderFilterSelect',
    articleListPanel: '#articleListPanel',
    logoutBtn: '#logoutBtn',
  },

  // ===== 其他 =====
  misc: {
    siteAvatar: '#siteAvatar',
    tiledWatermark: '#tiledWatermark',
    customTexture: '#customTexture',
    visibleWatermark: '#visibleWatermark',
    decoLogo: '#decoLogo',
    decoStamp: '#decoStamp',
    decoRaven: '#decoRaven',
  },

  // ===== 工具方法：获取单个元素 =====
  get: function (selector) {
    if (typeof selector === 'string') {
      return document.querySelector(selector);
    }
    return null;
  },

  // ===== 工具方法：获取多个元素 =====
  getAll: function (selector) {
    if (typeof selector === 'string') {
      return document.querySelectorAll(selector);
    }
    return null;
  },

  // ===== 工具方法：通过引用路径获取元素 =====
  getByPath: function (path) {
    const parts = path.split('.');
    let current = this;
    for (let i = 0; i < parts.length; i++) {
      if (current && current[parts[i]] !== undefined) {
        current = current[parts[i]];
      } else {
        return null;
      }
    }
    return typeof current === 'string' ? document.querySelector(current) : current;
  },
};

console.log('✅ DOMRefs 已加载 (ES Module)');
