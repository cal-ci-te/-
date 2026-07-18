import { DOMRefs } from '../core/dom-refs.js';
import { AppState } from '../core/app-state.js';
import { AdminState } from './state.js';
import { AdminPosition } from './position.js';
import { MUTATIONS } from '../core/state-mutations.js';

export const AdminDrag = {
  initDrag: function () {
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    const header = DOMRefs.get(DOMRefs.admin.header);
    if (!panel || !header) {
      console.warn('[Admin] 面板或标题不存在，无法初始化拖拽');
      return;
    }

    header.style.cursor = 'grab';
    header.style.userSelect = 'none';

    header.removeEventListener('mousedown', this._startDrag);
    header.removeEventListener('touchstart', this._startDragTouch);

    this._startDrag = this.startDrag.bind(this);
    this._startDragTouch = this.startDragTouch.bind(this);

    header.addEventListener('mousedown', this._startDrag);
    header.addEventListener('touchstart', this._startDragTouch, { passive: false });

    document.removeEventListener('mousemove', this._onDrag);
    document.removeEventListener('touchmove', this._onDragTouch);
    document.removeEventListener('mouseup', this._stopDrag);
    document.removeEventListener('touchend', this._stopDrag);

    this._onDrag = this.onDrag.bind(this);
    this._onDragTouch = this.onDragTouch.bind(this);
    this._stopDrag = this.stopDrag.bind(this);

    document.addEventListener('mousemove', this._onDrag);
    document.addEventListener('touchmove', this._onDragTouch, { passive: false });
    document.addEventListener('mouseup', this._stopDrag);
    document.addEventListener('touchend', this._stopDrag);

    console.log('[Admin] 拖拽已初始化');
  },

  startDrag: function (e) {
    if (e.target.closest('.toggle-icon')) return;
    AdminState.isDraggingPanel = true;
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    const rect = panel.getBoundingClientRect();
    AdminState.dragStartX = e.clientX - rect.left;
    AdminState.dragStartY = e.clientY - rect.top;
    panel.style.transition = 'none';
    e.preventDefault();
  },

  startDragTouch: function (e) {
    if (e.target.closest('.toggle-icon')) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    AdminState.isDraggingPanel = true;
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    const rect = panel.getBoundingClientRect();
    AdminState.dragStartX = touch.clientX - rect.left;
    AdminState.dragStartY = touch.clientY - rect.top;
    panel.style.transition = 'none';
  },

  onDrag: function (e) {
    if (!AdminState.isDraggingPanel) return;
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    const panelWidth = panel.offsetWidth || 48;
    const panelHeight = panel.offsetHeight || 50;
    let newRight = window.innerWidth - (e.clientX - AdminState.dragStartX + panelWidth);
    let newBottom = window.innerHeight - (e.clientY - AdminState.dragStartY + panelHeight);
    newRight = Math.max(0, Math.min(newRight, window.innerWidth - 50));
    newBottom = Math.max(0, Math.min(newBottom, window.innerHeight - 50));
    AppState.commit(MUTATIONS.SET_PANEL_POSITION, { right: newRight, bottom: newBottom });
    panel.style.right = newRight + 'px';
    panel.style.bottom = newBottom + 'px';
    panel.style.left = 'auto';
    panel.style.top = 'auto';
  },

  onDragTouch: function (e) {
    if (!AdminState.isDraggingPanel) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    const panel = DOMRefs.get(DOMRefs.admin.panel);
    const panelWidth = panel.offsetWidth || 48;
    const panelHeight = panel.offsetHeight || 50;
    let newRight = window.innerWidth - (touch.clientX - AdminState.dragStartX + panelWidth);
    let newBottom = window.innerHeight - (touch.clientY - AdminState.dragStartY + panelHeight);
    newRight = Math.max(0, Math.min(newRight, window.innerWidth - 50));
    newBottom = Math.max(0, Math.min(newBottom, window.innerHeight - 50));
    AppState.commit(MUTATIONS.SET_PANEL_POSITION, { right: newRight, bottom: newBottom });
    panel.style.right = newRight + 'px';
    panel.style.bottom = newBottom + 'px';
    panel.style.left = 'auto';
    panel.style.top = 'auto';
  },

  stopDrag: function () {
    if (AdminState.isDraggingPanel) {
      AdminState.isDraggingPanel = false;
      const panel = DOMRefs.get(DOMRefs.admin.panel);
      if (panel) panel.style.transition = '';
      AdminPosition.savePosition();
    }
  },
};

