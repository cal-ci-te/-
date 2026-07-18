export const EVENTS = {
  // 文章相关
  ARTICLE_VISIBILITY_CHANGED: 'article:visibility-changed',
  ARTICLE_MADE_INVISIBLE: 'article:made-invisible',
  ARTICLE_DATA_LOADED: 'article:data-loaded',
  ARTICLE_DATA_LOADING: 'article:data-loading',
  ARTICLE_DATA_ERROR: 'article:data-error',
  // 新增：文章数据更新（用于目录树→文章列表解耦）
  ARTICLES_UPDATED: 'articles:updated',

  // UI相关
  UI_INITIALIZED: 'ui:initialized',
  UI_REFRESH: 'ui:refresh',

  // 认证相关
  AUTH_LOGGED_IN: 'auth:logged-in',
  AUTH_LOGGED_OUT: 'auth:logged-out',

  // 管理面板
  PANEL_TOGGLED: 'panel:toggled',
  PANEL_COLLAPSED: 'panel:collapsed',

  // 贴图相关
  DECO_LIBRARY_CHANGED: 'deco:library-changed',
  DECO_EDITING_STARTED: 'deco:editing-started',
  DECO_EDITING_STOPPED: 'deco:editing-stopped',

  // WebSocket
  WS_CONNECTED: 'ws:connected',
  WS_DISCONNECTED: 'ws:disconnected',
  WS_VISIBILITY_CHANGED: 'ws:visibility-changed',

  // 通知
  NOTIFICATION_SHOW: 'notification:show',
  NOTIFICATION_HIDE: 'notification:hide',

  ARTICLES_LIST_UPDATED: 'articles:list-updated',
};

