// ========== 移动端位置管理控件 ==========

let _controlsInstance = null;

/**
 * 创建移动端控件
 * @param {HTMLElement} container - 目录树容器
 * @param {Object} callbacks - { onSave, onCancel }
 * @returns {HTMLElement} 控件元素
 */
export function createMobileControls(container, callbacks) {
    if (document.getElementById('mobilePositionControls')) {
        return document.getElementById('mobilePositionControls');
    }

    const controls = document.createElement('div');
    controls.id = 'mobilePositionControls';
    controls.className = 'mobile-position-controls';
    controls.style.display = 'none';
    controls.innerHTML = `
        <div class="mobile-pos-hint">📌 拖拽节点调整顺序</div>
        <div class="mobile-pos-actions">
            <button class="mobile-pos-save" data-action="mobile-pos-save">💾 保存</button>
            <button class="mobile-pos-cancel" data-action="mobile-pos-cancel">❌ 取消</button>
        </div>
    `;

    container.parentNode.insertBefore(controls, container);

    controls.querySelector('.mobile-pos-save').addEventListener('click', () => {
        if (callbacks.onSave) callbacks.onSave();
    });
    controls.querySelector('.mobile-pos-cancel').addEventListener('click', () => {
        if (callbacks.onCancel) callbacks.onCancel();
    });

    _controlsInstance = controls;
    return controls;
}

/**
 * 显示移动端控件
 */
export function showMobileControls() {
    if (_controlsInstance) {
        _controlsInstance.style.display = 'block';
    }
}

/**
 * 隐藏移动端控件
 */
export function hideMobileControls() {
    if (_controlsInstance) {
        _controlsInstance.style.display = 'none';
    }
}

/**
 * 销毁移动端控件
 */
export function destroyMobileControls() {
    if (_controlsInstance) {
        _controlsInstance.remove();
        _controlsInstance = null;
    }
}

/**
 * 重建移动端控件（在目录树重新渲染后调用）
 */
export function recreateMobileControls(container, callbacks) {
    destroyMobileControls();
    return createMobileControls(container, callbacks);
}