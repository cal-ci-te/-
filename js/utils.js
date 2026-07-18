// 此文件保持向后兼容，新代码推荐直接从子模块导入

import { showToast, hideToast } from './utils/toast.js';
import { escapeHtml } from './utils/dom.js';
import { debounce, throttle } from './utils/function.js';
import { storage } from './utils/storage.js';
import { compressImage } from './utils/image.js';

// 重新导出，保持原有 Utils 对象结构
export const Utils = {
  showToast,
  hideToast,
  escapeHtml,
  debounce,
  storage,
  compressImage,
  // 如果其他地方依赖 throttle，可加上
  throttle,
};

