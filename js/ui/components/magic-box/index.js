// 超现实箱子主控模块 — 组装 State / Renderer / Drag，管理完整交互生命周期。
// 设计参照 Puzzle 类模式：构造注入 → init() 挂载 → 拖拽/点击双路分发 → destroy() 清理。
import { BoxState } from './BoxState.js';
import { BoxRenderer } from './BoxRenderer.js';
import { BoxDrag } from './BoxDrag.js';
import { pickItem } from './BoxItemPool.js';
import { AppState } from '../../../core/app-state.js';
import { EventBus } from '../../../core/event-bus.js';
import { EVENTS } from '../../../core/event-constants.js';

export class BoxManager {
  constructor() {
    this._state = new BoxState();
    this._renderer = new BoxRenderer(this._state, {
      defaultRight: 30,
      defaultBottom: 30,
    });
    this._drag = null; // 在 mount 后创建

    this._mounted = false;
    this._interactive = true; // false 时禁止点击和拖拽（飞回动画期间）
  }

  /** 初始化：挂载 DOM → 绑定交互 → 加载持久化状态 */
  init() {
    if (this._mounted) return this;

    // 挂载 DOM
    this._renderer.mount();
    this._mounted = true;

    // 加载持久化状态
    this._state.load();
    this._renderer.refreshCount();

    // 创建拖拽处理器
    const el = this._renderer.getElement();
    const self = this;

    this._drag = new BoxDrag(el, {
      onClick: function () { self._handleClick(); },
      onDragStart: function () { self._handleDragStart(); },
      onDragMove: function (dx, dy, newLeft, newTop) {
        self._renderer.moveTo(newLeft, newTop);
      },
      onDragEnd: function (finalLeft, finalTop, isAdmin) {
        self._handleDragEnd(finalLeft, finalTop, isAdmin);
      },
      isAdmin: function () { return self._isAdmin(); },
    });

    this._drag.enable();

    // 监听主题变更（用于刷新拼图背景等，当前箱子无依赖，预留）
    EventBus.on(EVENTS.AUTH_LOGGED_IN, () => {
      console.log('[MagicBox] 管理员已登录，拖拽将设定新默认位置');
    });
    EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => {
      console.log('[MagicBox] 管理员已登出，拖拽将飞回默认位置');
    });

    console.log('[MagicBox] 初始化完成 — 位置:', this._state.hasCustomPosition()
      ? `自定义 (${this._state.getDefaultX()}, ${this._state.getDefaultY()})`
      : 'CSS 右下角默认',
      '| 已打开:', this._state.getCount(), '次');

    return this;
  }

  // ======================
  //  权限判断
  // ======================

  _isAdmin() {
    try {
      return !!AppState.get('isLoggedIn');
    } catch (e) {
      return false;
    }
  }

  // ======================
  //  交互处理
  // ======================

  _handleClick() {
    if (!this._interactive) return;
    if (this._renderer.isAnimating) return;

    this._openBox();
  }

  _handleDragStart() {
    this._renderer.setGrabbing(true);

    // 管理员拖拽时显示视觉提示
    if (this._isAdmin()) {
      this._renderer.setAdminHint(true);
    }
  }

  _handleDragEnd(finalLeft, finalTop, isAdmin) {
    this._renderer.setGrabbing(false);
    this._renderer.setAdminHint(false);

    if (isAdmin) {
      // 管理员：以拖拽终点为新默认位置，直接停留
      this._state.setDefaultPosition(finalLeft, finalTop);
      console.log('[MagicBox] 管理员设定新默认位置:', finalLeft, finalTop);
    } else {
      // 普通用户：飞回默认位置
      this._interactive = false;
      const self = this;
      this._renderer.flyToDefault(500);
      // 飞回结束后恢复交互
      setTimeout(function () {
        self._interactive = true;
      }, 520); // 略多于动画时长，确保 transition 结束
    }
  }

  // ======================
  //  开箱逻辑
  // ======================

  async _openBox() {
    const item = pickItem(this._state.getLastItemId());

    // EventBus 通知（可选广播）
    EventBus.emit('box:opened', { item });

    // 播放入场动画序列
    await this._renderer.playOpenSequence(item);

    // 更新计数器
    this._state.incrementCount();
    this._state.setLastItemId(item.id);
    this._renderer.refreshCount();

    // EventBus 通知物品已展示
    EventBus.emit('box:item-shown', { item, count: this._state.getCount() });
  }

  // ======================
  //  公开 API（供管理面板调用）
  // ======================

  /** 设置自定义箱子图片 */
  setCustomImage(dataUrl) {
    this._renderer.setCustomImage(dataUrl);
  }

  /** 获取当前状态快照 */
  getState() {
    return this._state.exportState();
  }

  /** 重置计数器 */
  resetCount() {
    this._state.resetCount();
    this._renderer.refreshCount();
  }

  /** 清除自定义位置，恢复 CSS 默认 */
  resetPosition() {
    this._state.clearPosition();
    this._renderer.flyToDefault(500);
  }

  destroy() {
    if (this._drag) {
      this._drag.destroy();
      this._drag = null;
    }
    if (this._renderer) {
      this._renderer.destroy();
      this._renderer = null;
    }
    this._state = null;
    this._mounted = false;
  }
}

// 单例工厂函数（与 initPuzzle 模式一致，便于 app.js 直接调用）
let _instance = null;

export function initMagicBox() {
  if (_instance) {
    console.warn('[MagicBox] 已初始化，跳过');
    return _instance;
  }
  _instance = new BoxManager();
  _instance.init();
  return _instance;
}

/** 获取当前实例（供外部模块引用） */
export function getMagicBox() {
  return _instance;
}
