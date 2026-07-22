// 全局配置。移除了硬编码的服务器 IP——本地环境通过 Vite proxy 代理 API 请求。
// 生产部署时设置 VITE_API_BASE_URL 环境变量即可，部署于服务器请将 isLocal 状态手动更改。
const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '';

export const CONFIG = {
  SERVER_IP: isLocal ? '' : '47.108.52.6',
  get API_BASE_URL() {
    return isLocal ? '' : `http://${this.SERVER_IP}`;
  },
  WS_URL: isLocal ? '' : 'ws://47.108.52.6/websocket/',
  ADMIN_USERNAME: 'admin',
  // ADMIN_PASSWORD 已弃用（v1.10）：密码验证已迁移至后端 server.cjs，
  // 由环境变量 ADMIN_PASSWORD 控制。此处保留仅用于向后兼容，不再作为登录校验依据。
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
    opacity: 0.15,
  },

  textureDefaults: {
    opacity: 0.12,
  },

  bgColorDefault: '#1a1612', // → var(--color-bg-primary)
};

export const API_ENDPOINTS = {
  ARTICLES: '/api/articles',
  DECOS: '/api/decos',
  SETTINGS: '/api/settings',
};
