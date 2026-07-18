import { AppState } from '../core/app-state.js';
import { MUTATIONS } from '../core/state-mutations.js';

export const AdminState = {
  // 使用 AppState 的 getter/setter，setter 改为 commit
  get isLoggedIn() {
    return AppState.get('isLoggedIn');
  },
  set isLoggedIn(value) {
    AppState.commit(MUTATIONS.SET_LOGGED_IN, value);
  },

  get panelCollapsed() {
    return AppState.get('panelCollapsed');
  },
  set panelCollapsed(value) {
    AppState.commit(MUTATIONS.SET_PANEL_COLLAPSED, value);
  },

  get panelRight() {
    return AppState.get('panelRight');
  },
  set panelRight(value) {
    // 单独设置右位置，但为保持一致性，使用 SET_PANEL_POSITION
    AppState.commit(MUTATIONS.SET_PANEL_POSITION, { right: value });
  },

  get panelBottom() {
    return AppState.get('panelBottom');
  },
  set panelBottom(value) {
    AppState.commit(MUTATIONS.SET_PANEL_POSITION, { bottom: value });
  },

  get decoEditing() {
    return AppState.get('decoEditing');
  },
  set decoEditing(value) {
    AppState.commit(MUTATIONS.SET_DECO_EDITING, value);
  },

  isDraggingPanel: false,
  dragStartX: 0,
  dragStartY: 0,
};

