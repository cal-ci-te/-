
/**
 * 为容器元素添加长按监听，长按时触发回调
 * @param {HTMLElement} container - 要监听的容器元素
 * @param {Function} callback - 长按时触发的回调，参数为 (touchEvent, targetData)
 * @param {Object} options - 可选配置
 * @param {number} options.duration - 长按阈值（毫秒），默认 500
 * @param {number} options.tolerance - 滑动容忍度（像素），默认 10
 * @param {Function} options.getTargetData - 从元素提取数据的方法，默认返回元素本身
 * @returns {Function} 清理函数，调用后可移除监听
 */
export function initLongPress(container, callback, options = {}) {
  if (!container) return () => {};

  const {
    duration = 500,
    tolerance = 10,
    getTargetData = (el) => el,
  } = options;

  let timer = null;
  let targetEl = null;
  let startX = 0, startY = 0;

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    targetEl = e.target;
    startX = touch.clientX;
    startY = touch.clientY;
    container._longPressTriggered = false;

    timer = setTimeout(() => {
      const data = getTargetData(targetEl);
      if (data) {
        callback(touch, data);
        container._longPressTriggered = true;
      }
      timer = null;
      targetEl = null;
    }, duration);
  };

  const onTouchMove = (e) => {
    if (!timer || !targetEl) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.sqrt(dx*dx + dy*dy) > tolerance) {
      clearTimeout(timer);
      timer = null;
      targetEl = null;
    }
  };

  const onTouchEnd = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      targetEl = null;
    }
  };

  container.addEventListener('touchstart', onTouchStart, { passive: false });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
  };
}