// 移动端模块统一导出（桶文件模式）——仅聚合子模块，不包含业务逻辑。

export { isMobile, hasTouchSupport, getDeviceType, isIOS, isAndroid } from './mobile-detector.js';
export { enableTouchDrag } from './touch-drag.js';
export { enableTouchContext } from './touch-context.js';