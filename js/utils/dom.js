
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

/**
 * 去除所有 HTML 标签，返回纯文本
 * @param {string} html - 含 HTML 标签的字符串
 * @returns {string} 纯文本
 */
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * 截取 HTML 内容到指定长度。
 * 若纯文本长度 ≤ maxLength，返回原始 HTML（保留富文本样式）；
 * 若超过，返回截断后的纯文本（卡片预览中丢失格式是可接受的）。
 * @param {string} html - HTML 字符串
 * @param {number} maxLength - 最大纯文本长度
 * @returns {string} 截断后的 HTML 或纯文本
 */
export function truncateHtml(html, maxLength) {
  if (!html) return '';
  if (typeof maxLength !== 'number' || maxLength <= 0) maxLength = 150;
  const plain = stripHtml(html);
  if (plain.length <= maxLength) return html;
  // 长文截断为纯文本（避免在卡片中拆散 HTML 标签结构）
  const truncated = plain.substring(0, maxLength).replace(/\s+\S*$/, '');
  return truncated + '…';
}