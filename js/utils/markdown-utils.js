/**
 * Markdown → HTML 轻量转换工具。
 * 两个编辑器（ArticleEditorMode / StickerEditorMode）共享此实现。
 *
 * @module markdown-utils
 */

import { Utils } from '../utils.js';

export var MarkdownUtils = {

  /**
   * 将 Markdown 文本转换为 HTML。
   * 支持：标题 h1-h3、粗体/斜体、行内代码/代码块、引用、无序列表、段落。
   *
   * @param {string} text - Markdown 原始文本
   * @returns {string} HTML 字符串
   */
  toHTML: function (text) {
    if (!text) return '<p style="color:var(--color-text-muted);">（空内容）</p>';

    var html = Utils.escapeHtml(text);

    // 代码块（在 inline code 之前处理）
    html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
      return '<pre><code>' + code + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // 粗体/斜体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // 引用
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    // 列表
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\s*)+/g, function (match) {
      return '<ul>' + match + '</ul>';
    });
    // 段落
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br><\/p>/g, '');
    html = html.replace(/<(h[1-6]|ul|ol|li|blockquote|pre)>/g, function (match) {
      return match.replace('<br>', '');
    });

    return html;
  }
};

export default MarkdownUtils;
