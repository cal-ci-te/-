// 超现实箱子拖拽处理 — 区分点击/拖拽（阈值 5px），管理员拖拽直接定位，普通用户拖拽后飞回。
// 复用了 PuzzleDrag 的文档级事件绑定 + 清理模式，但简化了滑块特有的像素计算。
const DRAG_THRESHOLD = 5; // px

export class BoxDrag {
  /**
   * @param {HTMLElement} element — 要绑定的箱子根元素
   * @param {object} callbacks
   * @param {Function} callbacks.onClick — 点击回调（非拖拽）
   * @param {Function} callbacks.onDragStart — 拖拽开始（用于设置 grabbing 样式等）
   * @param {Function} callbacks.onDragMove — (deltaX, deltaY, currentLeft, currentTop) 每次移动
   * @param {Function} callbacks.onDragEnd — (finalLeft, finalTop, isAdmin) 拖拽释放
   * @param {Function} callbacks.isAdmin — () => boolean 判断当前是否管理员
   */
  constructor(element, callbacks = {}) {
    this._el = element;
    this._onClick = callbacks.onClick || null;
    this._onDragStart = callbacks.onDragStart || null;
    this._onDragMove = callbacks.onDragMove || null;
    this._onDragEnd = callbacks.onDragEnd || null;
    this._isAdmin = callbacks.isAdmin || (() => false);

    this._enabled = false;
    this._dragging = false;
    this._startX = 0;
    this._startY = 0;
    this._startLeft = 0;
    this._startTop = 0;

    // 绑定到实例的方法引用（用于 removeEventListener）
    this._onMouseDown = null;
    this._onTouchStart = null;
  }

  /** 启用拖拽（绑定事件） */
  enable() {
    if (this._enabled) return;
    if (!this._el) return;

    const self = this;

    this._onMouseDown = function (e) {
      if (e.button !== 0) return; // 仅左键
      e.preventDefault();
      self._startDrag(e.clientX, e.clientY);
    };

    this._onTouchStart = function (e) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      self._startDrag(touch.clientX, touch.clientY);
    };

    this._el.addEventListener('mousedown', this._onMouseDown);
    this._el.addEventListener('touchstart', this._onTouchStart, { passive: true });

    this._enabled = true;
  }

  /** 禁用拖拽（移除事件，用于飞回动画期间） */
  disable() {
    if (!this._enabled) return;
    if (this._el) {
      if (this._onMouseDown) {
        this._el.removeEventListener('mousedown', this._onMouseDown);
      }
      if (this._onTouchStart) {
        this._el.removeEventListener('touchstart', this._onTouchStart);
      }
    }
    this._enabled = false;
    this._dragging = false;
  }

  /** 获取当前是否处于拖拽中 */
  get isDragging() { return this._dragging; }

  // ------ 内部逻辑 ------

  _startDrag(clientX, clientY) {
    this._dragging = false;
    this._startX = clientX;
    this._startY = clientY;

    // 读取当前元素位置（仅读取 left/top，兼容使用 left/top 定位）
    const style = this._el ? this._el.style : {};
    this._startLeft = parseFloat(style.left) || 0;
    this._startTop = parseFloat(style.top) || 0;

    this._bindDocumentEvents();
  }

  _bindDocumentEvents() {
    const self = this;
    const getClient = (e) => {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    };

    const onMove = function (e) {
      const { x, y } = getClient(e);
      const dx = x - self._startX;
      const dy = y - self._startY;
      const dist = Math.hypot(dx, dy);

      if (!self._dragging && dist > DRAG_THRESHOLD) {
        self._dragging = true;
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        if (self._onDragStart) self._onDragStart();
      }

      if (self._dragging) {
        e.preventDefault();
        const newLeft = self._startLeft + dx;
        const newTop = self._startTop + dy;
        if (self._onDragMove) self._onDragMove(dx, dy, newLeft, newTop);
      }
    };

    const onEnd = function (e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      if (!self._dragging) {
        // 视为点击
        if (self._onClick) self._onClick();
      } else {
        // 拖拽结束
        const { x, y } = getClient(e);
        const dx = x - self._startX;
        const dy = y - self._startY;
        const finalLeft = self._startLeft + dx;
        const finalTop = self._startTop + dy;
        const admin = self._isAdmin();
        if (self._onDragEnd) self._onDragEnd(finalLeft, finalTop, admin);
      }
      self._dragging = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  destroy() {
    this.disable();
    this._onClick = null;
    this._onDragStart = null;
    this._onDragMove = null;
    this._onDragEnd = null;
    this._isAdmin = null;
    this._el = null;
  }
}
