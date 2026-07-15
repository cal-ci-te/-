// ========== Toast 提示工具 ==========
let toastTimer = null;
let toastElement = null;

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 * @param {boolean} isError - 是否为错误提示（红色样式）
 */
export function showToast(message, isError = false) {
  hideToast();
  const toast = document.createElement('div');
  toast.className = `toast-message ${isError ? 'error' : 'success'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  toastElement = toast;
  toastTimer = setTimeout(() => hideToast(), 2000);
}

/**
 * 立即隐藏当前 Toast
 */
export function hideToast() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastElement && toastElement.parentNode) {
    toastElement.parentNode.removeChild(toastElement);
    toastElement = null;
  }
}