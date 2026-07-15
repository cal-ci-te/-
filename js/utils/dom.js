// ========== DOM 辅助工具 ==========

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的 HTML 字符串
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}