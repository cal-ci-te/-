import { UI } from '../utils/ui-strings.js';

export function injectUITexts() {
    // ---- 页面标题 ----
    document.title = UI.common.siteTitle + ' - ' + UI.common.siteSubtitle;

    // ---- 通用元素 ----
    const siteTitle = document.getElementById('siteTitle');
    if (siteTitle) siteTitle.textContent = UI.common.siteTitle;

    const siteSubtitle = document.getElementById('siteSubtitle');
    if (siteSubtitle) siteSubtitle.textContent = UI.common.siteSubtitle;

    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) searchInput.placeholder = UI.common.searchPlaceholder;

    const copyrightBar = document.getElementById('copyrightBar');
    if (copyrightBar) {
        copyrightBar.textContent = UI.copyright
            .replace('{siteTitle}', UI.common.siteTitle)
            .replace('{siteSubtitle}', UI.common.siteSubtitle);
    }

    // ---- 首屏说明 ----
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) heroTitle.textContent = UI.hero.title;

    const heroDesc = document.getElementById('heroDescription');
    if (heroDesc) heroDesc.innerHTML = UI.hero.description;

    // ---- 登录 ----
    const loginLabel = document.getElementById('loginLabel');
    if (loginLabel) loginLabel.textContent = UI.login.triggerLabel;

    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) welcomeText.textContent = UI.login.welcomeText;

    const loginModalTitle = document.getElementById('loginModalTitle');
    if (loginModalTitle) loginModalTitle.textContent = UI.login.modalTitle;

    const loginUsernameLabel = document.getElementById('loginUsernameLabel');
    if (loginUsernameLabel) loginUsernameLabel.textContent = UI.login.usernameLabel;

    const loginPasswordLabel = document.getElementById('loginPasswordLabel');
    if (loginPasswordLabel) loginPasswordLabel.textContent = UI.login.passwordLabel;

    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) loginUsername.placeholder = UI.login.placeholderUsername;

    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.placeholder = UI.login.placeholderPassword;

    const modalLoginBtn = document.getElementById('modalLoginBtn');
    if (modalLoginBtn) modalLoginBtn.textContent = UI.login.loginButton;

    const loginHint = document.getElementById('loginHint');
    if (loginHint) loginHint.textContent = UI.login.hint;

    // ---- 头像裁剪 ----
    const cropTitle = document.getElementById('cropModalTitle');
    if (cropTitle) cropTitle.textContent = UI.crop.title;

    const cropPreviewLabel = document.getElementById('cropPreviewLabel');
    if (cropPreviewLabel) cropPreviewLabel.textContent = UI.crop.previewLabel;

    const cropCancel = document.getElementById('cropCancelBtn');
    if (cropCancel) cropCancel.textContent = UI.crop.cancel;

    const cropConfirm = document.getElementById('cropConfirmBtn');
    if (cropConfirm) cropConfirm.textContent = UI.crop.confirm;

    // ---- 管理员面板 ----
    const adminTitle = document.getElementById('adminPanelTitle');
    if (adminTitle) adminTitle.textContent = UI.admin.panelTitle;

    // ---- 侧边栏 ----
    const sidebarTitle = document.getElementById('sidebarTitle');
    if (sidebarTitle) sidebarTitle.textContent = '📜';

    // ---- 位置管理控件 ----
    const enterPosBtn = document.getElementById('enterPositionModeBtn');
    if (enterPosBtn) enterPosBtn.textContent = UI.admin.positionModeEnter;

    const savePosBtn = document.getElementById('savePositionChangesBtn');
    if (savePosBtn) savePosBtn.textContent = UI.admin.positionModeSave;

    const cancelPosBtn = document.getElementById('cancelPositionChangesBtn');
    if (cancelPosBtn) cancelPosBtn.textContent = UI.admin.positionModeCancel;

    const posHint = document.getElementById('positionModeHint');
    if (posHint) posHint.textContent = UI.admin.positionModeHint;

    // ---- 目录加载占位 ----
    const dirLoading = document.getElementById('directoryLoading');
    if (dirLoading) dirLoading.textContent = UI.directory.loading;

    // ---- 文章列表加载 ----
    const articlesLoading = document.getElementById('articlesLoading');
    if (articlesLoading) articlesLoading.textContent = UI.articles.loading;

    // ---- 可见水印 ----
    const visibleWatermark = document.getElementById('visibleWatermark');
    if (visibleWatermark) {
        visibleWatermark.textContent = `© ${UI.common.siteTitle} · ${UI.common.siteSubtitle} · 内容受保护`;
    }

    console.log('[ui-injector] UI 文案注入完成');
}