export const DOMRefs = {
  sidebar: {
    container: '#sidebar',
    toggleBtn: '#sidebarCollapseBtn',
    searchInput: '#sidebarSearchInput',
    directoryTree: '#directoryTree',
    overlay: '#sidebarOverlay',
  },

  articles: {
    container: '#articlesContainer',
  },

  detail: {
    overlay: '#detailOverlay',
    content: '#detailContent',
    closeBtn: '#detailCloseBtn',
    body: '#detailBody',
  },

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

  crop: {
    overlay: '#avatarCropModalOverlay',
    canvas: '#cropCanvas',
    previewCanvas: '#previewCanvas',
    confirmBtn: '#cropConfirmBtn',
    cancelBtn: '#cropCancelBtn',
    closeBtn: '#cropModalCloseBtn',
  },

  admin: {
    panel: '#adminPanel',
    header: '#panelHeader',
    content: '#panelContent',
    toggleIcon: '#panelToggleIcon',
  },

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

  misc: {
    siteAvatar: '#siteAvatar',
    tiledWatermark: '#tiledWatermark',
    customTexture: '#customTexture',
    visibleWatermark: '#visibleWatermark',
    decoLogo: '#decoLogo',
    decoStamp: '#decoStamp',
    decoRaven: '#decoRaven',
  },

  get: function (selector) {
    if (typeof selector === 'string') {
      return document.querySelector(selector);
    }
    return null;
  },

  getAll: function (selector) {
    if (typeof selector === 'string') {
      return document.querySelectorAll(selector);
    }
    return null;
  },

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

