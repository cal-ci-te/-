// ========== 管理员面板渲染（HTML生成） ==========
import { AdminPanel } from './index.js';
import { AdminAvatar } from '../avatar.js';
import { AdminPosition } from '../position.js';
import { DOMRefs } from '../../core/dom-refs.js';
import { Utils } from '../../utils.js';
import { Texture } from '../../services/texture.js';
import { HeroBackground } from '../../services/hero-background.js';
import { DecoShelfUI } from '../../ui/components/deco-ui.js';
import { EventBus } from '../../core/event-bus.js';
import { ArticleService } from '../../services/article-service.js';
import { UI } from '../../utils/ui-strings.js';
import { DecoShelf } from '../../services/deco.js';

// 标志：是否已完成首次完整渲染
AdminPanel._rendered = false;

AdminPanel.renderContent = function () {
    const panel = DOMRefs.get(DOMRefs.admin.content);
    if (!panel) {
        console.warn('[AdminPanel] panelContent 元素不存在');
        return;
    }

    if (AdminPanel._rendered) {
        console.log('[AdminPanel] 面板已渲染，仅刷新动态内容');
        const container = document.getElementById('assetListContainer');
        if (container && typeof DecoShelfUI !== 'undefined' && DecoShelfUI.render) {
            DecoShelfUI.render();
        }
        if (typeof AdminPanel.renderPalettes === 'function') {
            AdminPanel.renderPalettes();
        }
        return;
    }

    // ===== 首次渲染：生成完整面板HTML =====
    const savedAvatar = AdminAvatar.getAvatarForUser() || 'images/default-avatar.png';
    const currentMaxOpacity = Utils.storage.get('video_max_opacity');
    const opacityValue =
        currentMaxOpacity !== null && typeof currentMaxOpacity === 'number'
            ? Math.max(0, Math.min(1, currentMaxOpacity))
            : HeroBackground
                ? HeroBackground.maxOpacity
                : 1;

    const gradMode = Texture.bgMode || 'solid';
    const gradColors = Texture.gradientColors || ['#1a1612', '#2a231c'];
    const gradDir = Texture.gradientDirection || 'to bottom';
    const gradFeather = Texture.gradientFeather !== undefined ? Texture.gradientFeather : 50;

    panel.innerHTML = `
        <div class="avatar-upload-area">
            <div><img class="admin-avatar" id="adminAvatarPreview" src="${savedAvatar}" alt="${UI.admin.avatarUploadLabel}"></div>
            <button id="uploadAvatarBtn" data-action="upload-avatar" class="avatar-upload-btn">${UI.admin.avatarUploadLabel}</button>
            <div style="font-size: 9px; color: #7a6a58; margin-top: 4px;">${UI.admin.avatarHint}</div>
        </div>

        <div class="control-group">
            <label>${UI.admin.textureUploadLabel}</label>
            <input type="file" id="textureUpload" data-action="texture-upload" accept="image/png,image/jpeg,image/webp">
            <div class="texture-preview" id="texturePreview"></div>
            <div style="display: flex; gap: 8px; margin-top: 5px;">
                <button id="applyTextureBtn" data-action="apply-texture" style="margin: 0;">${UI.admin.textureApplyButton}</button>
                <button id="resetTextureBtn" data-action="reset-texture" style="margin: 0; background:#3a2a1a;">${UI.admin.textureRemoveButton}</button>
            </div>
        </div>
        <div class="control-group">
            <label>${UI.admin.textureOpacityLabel} <span id="textureOpacityValue">0.12</span></label>
            <div class="slider" style="display: flex; gap: 8px;">
                <span>0</span>
                <input type="range" id="textureOpacitySlider" data-action="texture-opacity" min="0" max="0.5" step="0.01" value="0.12" style="flex:1;">
                <span>0.5</span>
            </div>
        </div>

        <div class="control-group">
            <label>${UI.admin.watermarkTextLabel}</label>
            <input type="text" id="watermarkTextInput" value="${UI.config.defaultWatermarkText}">
        </div>
        <div class="control-group">
            <label>${UI.admin.watermarkOpacityLabel} <span id="opacityValue">0.08</span></label>
            <div class="slider" style="display: flex; gap: 8px;">
                <span>0</span>
                <input type="range" id="watermarkOpacitySlider" data-action="watermark-opacity" min="0" max="0.3" step="0.01" value="0.08" style="flex:1;">
                <span>0.3</span>
            </div>
        </div>
        <button id="applyWatermarkBtn" data-action="apply-watermark">${UI.admin.watermarkApplyButton}</button>

        <div class="control-group">
            <label>${UI.admin.videoOpacityLabel} <span id="videoMaxOpacityValue">${opacityValue.toFixed(2)}</span></label>
            <div class="slider" style="display: flex; gap: 8px;">
                <span>0</span>
                <input type="range" id="videoMaxOpacitySlider" data-action="video-opacity" min="0" max="1" step="0.01" value="${opacityValue}" style="flex:1;">
                <span>1</span>
            </div>
            <div style="font-size: 9px; color: #7a6a58; margin-top: 4px;">${UI.admin.videoOpacityHint}</div>
        </div>

        <div class="control-group" style="border-top: 1px solid #5a3e2b; padding-top: 12px; margin-top: 12px;">
            <label>${UI.admin.bgModeLabel}</label>
            <div style="display: flex; gap: 12px; margin: 4px 0 8px;">
                <label style="color: #c4b5a0; font-size: 12px;">
                    <input type="radio" name="bgMode" data-action="bg-mode" value="solid" ${gradMode === 'solid' ? 'checked' : ''}> ${UI.admin.bgModeSolid}
                </label>
                <label style="color: #c4b5a0; font-size: 12px;">
                    <input type="radio" name="bgMode" data-action="bg-mode" value="gradient" ${gradMode === 'gradient' ? 'checked' : ''}> ${UI.admin.bgModeGradient}
                </label>
            </div>
        </div>

        <div id="gradientControls" style="${gradMode === 'gradient' ? '' : 'display: none;'}">
            <div class="control-group">
                <label>${UI.admin.gradientColorLabel}</label>
                <div id="colorPickers" style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <input type="color" id="gradColor1" value="${gradColors[0] || '#1a1612'}" style="flex:1; min-width:60px;">
                    <input type="color" id="gradColor2" value="${gradColors[1] || '#2a231c'}" style="flex:1; min-width:60px;">
                    <input type="color" id="gradColor3" value="${gradColors[2] || '#3a2a1a'}" style="flex:1; min-width:60px; ${gradColors.length >= 3 ? '' : 'display:none;'}">
                </div>
                <div style="font-size: 9px; color: #7a6a58; margin-top: 2px;">${UI.admin.gradientColorHint}</div>
            </div>
            <div class="control-group">
                <label>${UI.admin.gradientDirectionLabel}</label>
                <select id="gradDirection" data-action="grad-direction" style="width:100%;">
                    <option value="to bottom" ${gradDir === 'to bottom' ? 'selected' : ''}>上→下</option>
                    <option value="to top" ${gradDir === 'to top' ? 'selected' : ''}>下→上</option>
                    <option value="to left" ${gradDir === 'to left' ? 'selected' : ''}>右→左</option>
                    <option value="to right" ${gradDir === 'to right' ? 'selected' : ''}>左→右</option>
                    <option value="to bottom right" ${gradDir === 'to bottom right' ? 'selected' : ''}>左上→右下</option>
                    <option value="to bottom left" ${gradDir === 'to bottom left' ? 'selected' : ''}>右上→左下</option>
                </select>
            </div>
            <div class="control-group">
                <label>${UI.admin.gradientFeatherLabel} <span id="gradFeatherValue">${gradFeather}</span></label>
                <div class="slider" style="display: flex; gap: 8px;">
                    <span>0</span>
                    <input type="range" id="gradFeatherSlider" data-action="grad-feather" min="0" max="100" step="1" value="${gradFeather}" style="flex:1;">
                    <span>100</span>
                </div>
                <div style="font-size: 9px; color: #7a6a58; margin-top: 2px;">${UI.admin.gradientFeatherHint}</div>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
                <button id="applyGradientBtn" data-action="apply-gradient" style="width: auto; background: #3a5a2b;">${UI.admin.gradientApplyButton}</button>
                <button id="savePaletteBtn" data-action="save-palette" style="width: auto; background: #5a3e2b;">${UI.admin.paletteSaveButton}</button>
            </div>
            <div style="margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap;">
                <input type="text" id="paletteNameInput" placeholder="${UI.admin.paletteNamePlaceholder}" style="flex:1; min-width:120px; background:#1e1a15; border:1px solid #5a3e2b; color:#e8d5b5; padding:4px 8px; border-radius:4px;">
            </div>
        </div>

        <div class="control-group" style="margin-top:8px;">
            <label>${UI.admin.paletteListLabel}</label>
            <div id="paletteList" style="max-height:120px; overflow-y:auto; border-top:1px solid #5a3e2b; padding-top:6px;"></div>
        </div>

        <!-- 贴图上传控件 -->
        <div class="control-group" style="margin-top:12px;">
            <label>${UI.admin.decoLibraryLabel}</label>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <button id="assetUploadBtn" style="width:auto;background:#3a5a2b;">${UI.admin.decoUploadButton}</button>
                <input type="file" id="assetFileInput" accept="image/png,image/webp,image/jpeg" style="display:none;">
            </div>
            <div style="font-size:9px;color:#7a6a58;margin-bottom:8px;">${UI.admin.decoUploadHint}</div>
            <div id="assetListContainer" style="min-height:60px;overflow-y:auto;border-top:1px solid #5a3e2b;padding-top:8px;">
                <div style="color:#7a6a58;text-align:center;padding:10px;">${UI.admin.decoLoading}</div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button id="confirmEditPosBtn" data-action="confirm-edit-pos" style="width:auto;background:#3a5a2b;">${UI.admin.confirmPosButton}</button>
                <button id="cancelEditPosBtn" data-action="cancel-edit-pos" style="width:auto;background:#3a2a1a;">${UI.admin.cancelPosButton}</button>
            </div>
        </div>

        <!-- 文章管理 -->
        <div class="control-group" style="border-top:1px solid #5a3e2b;padding-top:12px;margin-top:12px;">
            <label>${UI.admin.articleEditorLabel}</label>
            <button id="openArticleEditorBtn" style="width:100%;background:#3a5a2b;margin-top:4px;">${UI.admin.articleEditorButton}</button>
            <div style="font-size:9px;color:#7a6a58;margin-top:4px;">${UI.admin.articleEditorHint}</div>
        </div>

        <div class="control-group" style="margin-top:12px; border-top: 1px solid #5a3e2b; padding-top: 12px;">
            <label>${UI.admin.articleVisibilityLabel}</label>
            <div style="color: #c4b5a0; font-size: 12px; padding: 8px 0;">
                ${UI.admin.articleVisibilityHint}
            </div>
            <div style="font-size: 9px; color: #7a6a58; margin-top: 4px;">
                ${UI.admin.articleVisibilityHintAdmin}
            </div>
        </div>

        <button id="logoutBtn" data-action="logout" style="margin-top:12px;background:#3a2a1a;">${UI.admin.logoutButton}</button>
    `;

    console.log('[AdminPanel] 面板内容渲染完成（首次渲染）');

    // 初始化贴图库 UI
    const container = document.getElementById('assetListContainer');
    if (container) {
        DecoShelfUI.init(container);
        DecoShelfUI.render();
    }

    // 渲染色卡
    if (typeof AdminPanel.renderPalettes === 'function') {
        AdminPanel.renderPalettes();
    }

    // 绑定事件委托器（仅首次）
    if (typeof AdminPanel.bindEvents === 'function') {
        AdminPanel.bindEvents();
    }

    // 文章编辑器按钮
    const editorBtn = document.getElementById('openArticleEditorBtn');
    if (editorBtn) {
        editorBtn.addEventListener('click', function() {
            window.open('/article-editor.html', '_blank');
        });
    }

    // 绑定折叠按钮
    AdminPanel._bindToggleIconDirect();

    // ===== 绑定贴图上传事件（显式 click + 详细日志） =====
    const uploadBtn = document.getElementById('assetUploadBtn');
    const assetFileInput = document.getElementById('assetFileInput');

    if (uploadBtn && assetFileInput) {
        // 移除旧监听
        if (AdminPanel._uploadClickHandler) {
            uploadBtn.removeEventListener('click', AdminPanel._uploadClickHandler);
        }
        if (AdminPanel._assetFileHandler) {
            assetFileInput.removeEventListener('change', AdminPanel._assetFileHandler);
        }

        // 按钮点击 → 触发文件选择
        AdminPanel._uploadClickHandler = function(e) {
            e.stopPropagation();
            console.log('[Upload] 点击上传按钮，准备触发文件选择');
            assetFileInput.value = '';
            console.log('[Upload] 已清空 input.value，调用 click()');
            assetFileInput.click();
        };
        uploadBtn.addEventListener('click', AdminPanel._uploadClickHandler);

        // 文件选择后的处理（修正：先保存文件对象，再清空 value）
        AdminPanel._assetFileHandler = async function(event) {
            const fileInput = event.target;
            console.log('[Upload] change 事件触发，input 元素:', fileInput);
            // ★★★ 关键修复：先获取文件对象，再清空 value ★★★
            const file = fileInput.files[0];
            // 清空 value 以便下次选择
            fileInput.value = '';
            console.log('[Upload] 已清空 input.value');

            if (!file) {
                console.warn('[Upload] 无文件（可能用户取消）');
                return;
            }

            console.log('[Upload] 选择文件:', file.name, file.type, file.size);

            const validTypes = ['image/png', 'image/webp', 'image/jpeg'];
            if (!validTypes.includes(file.type)) {
                Utils.showToast('格式不正确，只支持 PNG、WebP、JPG 格式', true);
                return;
            }

            const defaultName = file.name.replace(/\.[^.]+$/, '');
            const name = prompt('请输入贴图名称（不含扩展名）：', defaultName);
            if (name === null) {
                console.log('[Upload] 用户取消命名');
                return;
            }

            try {
                console.log('[Upload] 开始上传:', name);
                await DecoShelf.upload(file, name);
                Utils.showToast('贴图 "' + name + '" 上传成功', false);
                console.log('[Upload] 上传成功');
            } catch (err) {
                console.error('[Upload] 上传失败:', err);
                Utils.showToast('上传失败：' + (err.message || '未知错误'), true);
            }
        };
        assetFileInput.addEventListener('change', AdminPanel._assetFileHandler);

        console.log('[Upload] 上传事件绑定完成（显式 click）');
    } else {
        console.warn('[AdminPanel] 上传控件未找到，请检查 DOM');
    }

    // 标记为已渲染
    AdminPanel._rendered = true;
};

// 其他函数（_bindToggleIconDirect, unbindEvents）保持不变
AdminPanel._bindToggleIconDirect = function () {
    const toggleIcon = document.getElementById('panelToggleIcon');
    if (!toggleIcon) {
        console.warn('[AdminPanel] #panelToggleIcon 不存在');
        return;
    }
    if (AdminPanel._directToggleHandler) {
        toggleIcon.removeEventListener('click', AdminPanel._directToggleHandler);
    }
    AdminPanel._directToggleHandler = function (e) {
        e.stopPropagation();
        console.log('[AdminPanel] 直接点击折叠按钮');
        if (typeof AdminPosition !== 'undefined' && AdminPosition.toggleCollapse) {
            AdminPosition.toggleCollapse();
        }
    };
    toggleIcon.addEventListener('click', AdminPanel._directToggleHandler);
    console.log('[AdminPanel] 直接绑定折叠按钮完成');
};

// 保持 unbindEvents 兼容
const originalUnbind = AdminPanel.unbindEvents;
AdminPanel.unbindEvents = function () {
    const toggleIcon = document.getElementById('panelToggleIcon');
    if (toggleIcon && AdminPanel._directToggleHandler) {
        toggleIcon.removeEventListener('click', AdminPanel._directToggleHandler);
        delete AdminPanel._directToggleHandler;
        console.log('[AdminPanel] 直接绑定已清理');
    }
    const uploadBtn = document.getElementById('assetUploadBtn');
    const assetFileInput = document.getElementById('assetFileInput');
    if (uploadBtn && AdminPanel._uploadClickHandler) {
        uploadBtn.removeEventListener('click', AdminPanel._uploadClickHandler);
        delete AdminPanel._uploadClickHandler;
        console.log('[AdminPanel] 上传点击事件已清理');
    }
    if (assetFileInput && AdminPanel._assetFileHandler) {
        assetFileInput.removeEventListener('change', AdminPanel._assetFileHandler);
        delete AdminPanel._assetFileHandler;
        console.log('[AdminPanel] 上传 change 事件已清理');
    }
    if (typeof originalUnbind === 'function') {
        originalUnbind.call(this);
    }
};

console.log('✅ AdminPanel.renderContent 已加载（显式 click + 日志）');