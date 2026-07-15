// @ts-check

// ========== 状态管理中心 ==========
import { MUTATIONS, mutationFor } from './state-mutations.js';

// 定义内部 mutation 处理函数
const mutationHandlers = {
  [MUTATIONS.SET_LOGGED_IN]: (state, payload) => { state.isLoggedIn = payload; },
  [MUTATIONS.SET_PANEL_POSITION]: (state, payload) => {
    if (payload.right !== undefined) state.panelRight = payload.right;
    if (payload.bottom !== undefined) state.panelBottom = payload.bottom;
  },
  [MUTATIONS.SET_PANEL_COLLAPSED]: (state, payload) => { state.panelCollapsed = payload; },
  [MUTATIONS.SET_SIDEBAR_COLLAPSED]: (state, payload) => { state.sidebarCollapsed = payload; },
  [MUTATIONS.SET_SIDEBAR_POSITION]: (state, payload) => {
    if (payload.left !== undefined) state.sidebarLeft = payload.left;
    if (payload.top !== undefined) state.sidebarTop = payload.top;
  },
  [MUTATIONS.SET_DECO_EDITING]: (state, payload) => { state.decoEditing = payload; },
  [MUTATIONS.SET_WATERMARK_TEXT]: (state, payload) => { state.watermarkText = payload; },
  [MUTATIONS.SET_WATERMARK_OPACITY]: (state, payload) => { state.watermarkOpacity = payload; },
  [MUTATIONS.SET_TEXTURE_URL]: (state, payload) => { state.textureDataUrl = payload; },
  [MUTATIONS.SET_TEXTURE_OPACITY]: (state, payload) => { state.textureOpacity = payload; },
  [MUTATIONS.SET_BG_COLOR]: (state, payload) => { state.bgColor = payload; },
  [MUTATIONS.SET_ARTICLES]: (state, payload) => { state.articles = payload; },
  [MUTATIONS.SET_VISIBLE_ARTICLES]: (state, payload) => { state.visibleArticles = payload; },
  [MUTATIONS.SET_ARTICLE_VISIBILITY]: (state, payload) => { state.articleVisibility = payload; },
  [MUTATIONS.SET_ADMIN]: (state, payload) => { state.admin = payload; },
  [MUTATIONS.SET_UI]: (state, payload) => { state.ui = payload; },
  // 通用 SET_KEY：支持任意键
  [MUTATIONS.SET_KEY]: (state, payload) => {
    if (payload && payload.key !== undefined) {
      state[payload.key] = payload.value;
    }
  },
};

// mutation 类型到 state key 的映射（用于通知）
const mutationKeyMap = {
  [MUTATIONS.SET_LOGGED_IN]: 'isLoggedIn',
  [MUTATIONS.SET_PANEL_POSITION]: ['panelRight', 'panelBottom'],
  [MUTATIONS.SET_PANEL_COLLAPSED]: 'panelCollapsed',
  [MUTATIONS.SET_SIDEBAR_COLLAPSED]: 'sidebarCollapsed',
  [MUTATIONS.SET_SIDEBAR_POSITION]: ['sidebarLeft', 'sidebarTop'],
  [MUTATIONS.SET_DECO_EDITING]: 'decoEditing',
  [MUTATIONS.SET_WATERMARK_TEXT]: 'watermarkText',
  [MUTATIONS.SET_WATERMARK_OPACITY]: 'watermarkOpacity',
  [MUTATIONS.SET_TEXTURE_URL]: 'textureDataUrl',
  [MUTATIONS.SET_TEXTURE_OPACITY]: 'textureOpacity',
  [MUTATIONS.SET_BG_COLOR]: 'bgColor',
  [MUTATIONS.SET_ARTICLES]: 'articles',
  [MUTATIONS.SET_VISIBLE_ARTICLES]: 'visibleArticles',
  [MUTATIONS.SET_ARTICLE_VISIBILITY]: 'articleVisibility',
  [MUTATIONS.SET_ADMIN]: 'admin',
  [MUTATIONS.SET_UI]: 'ui',
  [MUTATIONS.SET_KEY]: null, // 特殊处理
};

export const AppState = {
  // ===== 内部状态 =====
  _state: {
    isLoggedIn: false,
    adminUsername: 'admin',
    panelCollapsed: true,
    panelRight: 20,
    panelBottom: 20,
    sidebarCollapsed: true,
    sidebarLeft: 20,
    sidebarTop: 80,
    decoEditing: false,
    articles: [],
    visibleArticles: [],
    articleVisibility: {},
    watermarkText: 'REVACHOL',
    watermarkOpacity: 0.08,
    textureDataUrl: null,
    textureOpacity: 0.12,
    bgColor: '#1a1612',
    admin: null,
    ui: null,
  },

  // ===== 订阅者列表 =====
  _subscribers: {},

  // ===== 获取状态 =====
  get: function (key) {
    return this._state[key];
  },

  // ===== 提交变更（推荐） =====
  commit: function (type, payload) {
    if (import.meta.env.DEV) {
      console.log(`[AppState] Mutation: ${type}`, payload);
    }

    const handler = mutationHandlers[type];
    if (!handler) {
      console.warn(`[AppState] 未知的 mutation 类型: ${type}`);
      return;
    }

    // 执行 mutation
    handler(this._state, payload);

    // 通知订阅者
    const keys = mutationKeyMap[type];
    if (keys === null) {
      // 对于 SET_KEY，需要从 payload 中提取 key
      if (payload && payload.key !== undefined) {
        this._notify(payload.key, payload.value, undefined);
      }
    } else if (Array.isArray(keys)) {
      keys.forEach((key) => {
        this._notify(key, this._state[key], undefined);
      });
    } else if (keys) {
      this._notify(keys, this._state[keys], undefined);
    }
  },

  // ===== 订阅状态变化 =====
  subscribe: function (key, callback) {
    if (!this._subscribers[key]) {
      this._subscribers[key] = [];
    }
    this._subscribers[key].push(callback);
    if (this._state[key] !== undefined) {
      callback(this._state[key], undefined);
    }
    return this;
  },

  // ===== 取消订阅 =====
  unsubscribe: function (key, callback) {
    if (!this._subscribers[key]) return this;
    if (callback) {
      this._subscribers[key] = this._subscribers[key].filter(function (cb) {
        return cb !== callback;
      });
    } else {
      delete this._subscribers[key];
    }
    return this;
  },

  // ===== 通知订阅者 =====
  _notify: function (key, newValue, oldValue) {
    if (!this._subscribers[key]) return;
    const callbacks = this._subscribers[key];
    for (let i = 0; i < callbacks.length; i++) {
      try {
        callbacks[i](newValue, oldValue);
      } catch (e) {
        console.error('[AppState] 状态更新错误:', key, e);
      }
    }
  },

  // ===== 重置状态 =====
  reset: function () {
    this._state = {
      isLoggedIn: false,
      adminUsername: 'admin',
      panelCollapsed: true,
      panelRight: 20,
      panelBottom: 20,
      sidebarCollapsed: true,
      sidebarLeft: 20,
      sidebarTop: 80,
      decoEditing: false,
      articles: [],
      visibleArticles: [],
      articleVisibility: {},
      watermarkText: 'REVACHOL',
      watermarkOpacity: 0.08,
      textureDataUrl: null,
      textureOpacity: 0.12,
      bgColor: '#1a1612',
      admin: null,
      ui: null,
    };
    this._subscribers = {};
    return this;
  },

  // ===== 导出状态（用于调试） =====
  snapshot: function () {
    return JSON.parse(JSON.stringify(this._state));
  },
};

console.log('✅ AppState 已加载 (ES Module)');
