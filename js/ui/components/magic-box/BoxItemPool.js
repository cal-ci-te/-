// 超现实箱子物品池 — 物品数据统一存放在 js/utils/ui-strings.js (UI.magicBox.items)。
import { UI } from '../../../utils/ui-strings.js';
const ITEMS = UI.magicBox.items;

/**
 * 从物品池中随机选取一个物品，保证与上一次不同
 * @param {string|null} lastItemId — 上一次弹出的物品 ID，null 表示首次
 * @returns {{ id: string, emoji: string, label: string, message: string }}
 */
export function pickItem(lastItemId) {
  const candidates = ITEMS.length === 1
    ? ITEMS
    : ITEMS.filter(item => item.id !== lastItemId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getAllItems() { return ITEMS.slice(); }
export { ITEMS };
