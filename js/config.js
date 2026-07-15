// 检测本地环境
const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '';

export const CONFIG = {
  SERVER_IP: isLocal ? '' : '47.108.52.6',
  get API_BASE_URL() {
    return isLocal ? '' : `http://${this.SERVER_IP}`;
  },
  // 本地环境明确设为空字符串，防止 fallback
  WS_URL: isLocal ? '' : 'ws://47.108.52.6/websocket/',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin123',
  CACHE_TTL: 5 * 60 * 1000,

  protection: {
    enableObfuscation: false,
    enableWatermark: true,
  },

  decoDefaults: {
    decoLogo: { top: '20px', left: '20px' },
    decoStamp: { bottom: '80px', right: '30px' },
    decoRaven: { bottom: '25px', left: '25px' },
  },

  watermarkDefaults: {
    text: 'REVACHOL',
    opacity: 0.15, // 提高至 0.15，便于本地调试可见
  },

  textureDefaults: {
    opacity: 0.12,
  },

  bgColorDefault: '#1a1612',
};

console.log(
  '[Config] 环境:',
  isLocal ? '本地(模拟数据)' : '生产',
  'API_BASE_URL:',
  CONFIG.API_BASE_URL
);

// ========== API 端点配置（新增） ==========
export const API_ENDPOINTS = {
  ARTICLES: '/api/articles',
  DECOS: '/api/decos',
  SETTINGS: '/api/settings',
  // 未来可扩展
};
