// 超现实箱子渲染层 — DOM 创建、3D 动画序列控制、计数器更新、自定义图片渲染。
// 开箱动画时序通过 async/await + delay() 控制，CSS transition 驱动视觉效果。
const DELAY = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 动画各阶段时长（毫秒）
const TIMING = {
  OPEN: 400,       // 开箱
  ITEM_POP: 600,   // 物品弹出
  SHOW: 1500,      // 展示停留
  ITEM_RETRACT: 400, // 物品收回
  CLOSE: 400,      // 关箱
};

export class BoxRenderer {
  /**
   * @param {import('./BoxState.js').BoxState} state
   * @param {object} [options]
   * @param {number} [options.defaultRight=30] — CSS 默认 right 值
   * @param {number} [options.defaultBottom=30] — CSS 默认 bottom 值
   */
  constructor(state, options = {}) {
    this._state = state;
    this._defaultRight = options.defaultRight || 30;
    this._defaultBottom = options.defaultBottom || 30;

    // DOM 引用
    this._container = null;
    this._boxEl = null;
    this._lidEl = null;
    this._itemEl = null;
    this._itemEmojiEl = null;
    this._itemLabelEl = null;
    this._itemMessageEl = null;
    this._countEl = null;
    this._bodyEl = null;

    this._isAnimating = false;
    this._flyTimer = null;
  }

  /** 是否正在播放动画（开箱或飞回） */
  get isAnimating() { return this._isAnimating; }

  // ======================
  //  DOM 创建
  // ======================

  /** 创建并挂载箱子 DOM */
  mount() {
    if (this._container) return; // 已挂载

    const self = this;

    // 容器
    const container = document.createElement('div');
    container.className = 'magic-box-container';
    container.id = 'magicBox';

    // 自定义图片层（默认隐藏）
    const customImg = document.createElement('div');
    customImg.className = 'magic-box-custom-img';
    container.appendChild(customImg);

    // 箱子主体
    const box = document.createElement('div');
    box.className = 'magic-box';

    // 箱盖
    const lid = document.createElement('div');
    lid.className = 'magic-box-lid';
    lid.innerHTML = '<div class="magic-box-lid-top"></div><div class="magic-box-hinge"></div>';
    box.appendChild(lid);

    // 箱子身体（正面的装饰面板）
    const body = document.createElement('div');
    body.className = 'magic-box-body';
    body.innerHTML = '<div class="magic-box-lock"></div>';
    box.appendChild(body);

    // 物品展示区
    const item = document.createElement('div');
    item.className = 'magic-box-item';
    const emojiEl = document.createElement('span');
    emojiEl.className = 'magic-box-item-emoji';
    const labelEl = document.createElement('span');
    labelEl.className = 'magic-box-item-label';
    const msgEl = document.createElement('span');
    msgEl.className = 'magic-box-item-message';
    item.appendChild(emojiEl);
    item.appendChild(labelEl);
    item.appendChild(msgEl);
    box.appendChild(item);

    // 计数器
    const count = document.createElement('div');
    count.className = 'magic-box-count';

    box.appendChild(count);
    container.appendChild(box);

    // 确保 body 可用
    if (document.body) {
      document.body.appendChild(container);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(container);
      });
    }

    this._container = container;
    this._boxEl = box;
    this._lidEl = lid;
    this._itemEl = item;
    this._itemEmojiEl = emojiEl;
    this._itemLabelEl = labelEl;
    this._itemMessageEl = msgEl;
    this._countEl = count;
    this._bodyEl = body;
    this._customImgEl = customImg;

    // 应用初始位置
    this._applyInitialPosition();
    // 应用自定义图片
    this._applyCustomImage();
    // 更新计数器文字
    this._updateCountDisplay();
  }

  /** 返回箱子根容器元素 */
  getElement() {
    return this._container;
  }

  // ======================
  //  位置管理
  // ======================

  /** 应用初始位置（从 state 读取，无自定义则用 CSS 右下角） */
  _applyInitialPosition() {
    if (!this._container) return;
    const x = this._state.getDefaultX();
    const y = this._state.getDefaultY();
    if (x !== null && y !== null) {
      this._container.style.left = x + 'px';
      this._container.style.top = y + 'px';
      this._container.style.right = 'auto';
      this._container.style.bottom = 'auto';
    }
    // 否则保持 CSS 默认（right: 30px, bottom: 30px）
  }

  /** 将箱子移动到指定位置（left/top），清除 transition 避免拖拽时触发动画 */
  moveTo(left, top) {
    if (!this._container) return;
    this._container.style.transition = 'none';
    this._container.style.left = left + 'px';
    this._container.style.top = top + 'px';
    this._container.style.right = 'auto';
    this._container.style.bottom = 'auto';
  }

  /** 获取当前 left 和 top 像素值 */
  getCurrentPosition() {
    if (!this._container) return { left: 0, top: 0 };
    const rect = this._container.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  }

  /** 获取 CSS 右下角默认位置对应的 left/top 坐标 */
  _getDefaultLeftTop() {
    if (!this._container) return { left: 0, top: 0 };
    const w = this._container.offsetWidth || 120;
    const h = this._container.offsetHeight || 100;
    return {
      left: window.innerWidth - w - this._defaultRight,
      top: window.innerHeight - h - this._defaultBottom,
    };
  }

  /** 飞回到默认位置（含弹簧动画），duration 后恢复交互 */
  flyToDefault(duration = 500) {
    if (!this._container) return;
    const self = this;

    // 确定目标位置
    let targetLeft, targetTop;
    if (this._state.hasCustomPosition()) {
      targetLeft = this._state.getDefaultX();
      targetTop = this._state.getDefaultY();
    } else {
      const def = this._getDefaultLeftTop();
      targetLeft = def.left;
      targetTop = def.top;
    }

    this._isAnimating = true;

    // 开启 transition
    this._container.style.transition = `left ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1), top ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    this._container.style.left = targetLeft + 'px';
    this._container.style.top = targetTop + 'px';
    this._container.style.right = 'auto';
    this._container.style.bottom = 'auto';

    if (this._flyTimer) clearTimeout(this._flyTimer);
    this._flyTimer = setTimeout(function () {
      self._container.style.transition = '';
      self._isAnimating = false;
      self._flyTimer = null;
    }, duration);
  }

  // ======================
  //  开箱动画序列
  // ======================

  /**
   * 播放完整开箱动画序列，共 5 阶段约 3.3 秒
   * @param {{ emoji: string, label: string, message: string }} item — 物品数据
   */
  async playOpenSequence(item) {
    if (!this._boxEl || this._isAnimating) return;
    this._isAnimating = true;

    // 设置物品内容
    this._itemEmojiEl.textContent = item.emoji;
    this._itemLabelEl.textContent = item.label;
    this._itemMessageEl.textContent = item.message;

    // 阶段 1：开箱（0.4s）
    this._boxEl.classList.add('opening');
    await DELAY(TIMING.OPEN);

    // 阶段 2：物品弹出（0.6s）
    this._itemEl.classList.add('popping');
    await DELAY(TIMING.ITEM_POP);

    // 阶段 3：展示（1.5s）
    this._itemEl.classList.remove('popping');
    this._itemEl.classList.add('showing');
    await DELAY(TIMING.SHOW);

    // 阶段 4：物品收回（0.4s）
    this._itemEl.classList.remove('showing');
    this._itemEl.classList.add('retracting');
    await DELAY(TIMING.ITEM_RETRACT);

    // 阶段 5：关箱（0.4s）
    this._itemEl.classList.remove('retracting');
    this._boxEl.classList.remove('opening');
    this._boxEl.classList.add('closing');
    await DELAY(TIMING.CLOSE);
    this._boxEl.classList.remove('closing');

    // 清理物品内容
    this._itemEmojiEl.textContent = '';
    this._itemLabelEl.textContent = '';
    this._itemMessageEl.textContent = '';

    this._isAnimating = false;
  }

  // ======================
  //  计数器
  // ======================

  _updateCountDisplay() {
    if (!this._countEl) return;
    const cnt = this._state.getCount();
    this._countEl.textContent = '已打开 ' + cnt + ' 次';
  }

  /** 外部调用：刷新计数器文本 */
  refreshCount() {
    this._updateCountDisplay();
  }

  // ======================
  //  自定义图片
  // ======================

  _applyCustomImage() {
    if (!this._customImgEl) return;
    const img = this._state.getCustomImage();
    if (img) {
      this._customImgEl.style.backgroundImage = 'url(' + img + ')';
      this._customImgEl.style.display = 'block';
      // 隐藏默认 CSS 外观
      if (this._bodyEl) this._bodyEl.style.opacity = '0';
      if (this._lidEl) this._lidEl.style.opacity = '0';
    } else {
      this._customImgEl.style.backgroundImage = '';
      this._customImgEl.style.display = 'none';
      if (this._bodyEl) this._bodyEl.style.opacity = '';
      if (this._lidEl) this._lidEl.style.opacity = '';
    }
  }

  /** 设置自定义图片并刷新渲染 */
  setCustomImage(dataUrl) {
    this._state.setCustomImage(dataUrl);
    this._applyCustomImage();
  }

  /** 设置拖拽状态下的抓取样式 */
  setGrabbing(active) {
    if (!this._boxEl) return;
    if (active) {
      this._boxEl.classList.add('grabbing');
    } else {
      this._boxEl.classList.remove('grabbing');
    }
  }

  /** 管理员模式高亮提示 */
  setAdminHint(active) {
    if (!this._boxEl) return;
    if (active) {
      this._boxEl.classList.add('admin-drag');
    } else {
      this._boxEl.classList.remove('admin-drag');
    }
  }

  destroy() {
    if (this._flyTimer) {
      clearTimeout(this._flyTimer);
      this._flyTimer = null;
    }
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._boxEl = null;
    this._lidEl = null;
    this._itemEl = null;
    this._itemEmojiEl = null;
    this._itemLabelEl = null;
    this._itemMessageEl = null;
    this._countEl = null;
    this._bodyEl = null;
    this._customImgEl = null;
  }
}
