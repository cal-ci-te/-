// 超现实箱子物品池 — 每次开箱随机弹出一个物品，连续两次不重复。
// 可后续扩展物品列表或从配置加载。
const ITEMS = [
  { id: 'feather', emoji: '🪶', label: '一根白色羽毛', message: '它轻得几乎不存在。' },
  { id: 'coin',   emoji: '🪙', label: '一枚旧硬币',   message: '年份已经模糊不清。' },
  { id: 'key',    emoji: '🗝️', label: '一把生锈的钥匙', message: '它不适合任何锁。' },
  { id: 'note',   emoji: '📄', label: '一张字条',     message: '上面写着："你。"' },
  { id: 'sand',   emoji: '⏳', label: '一粒沙',       message: '它来自一个你从未去过的海滩。' },
  { id: 'thread', emoji: '🧵', label: '一颗纽扣',     message: '它被缝在什么东西上——但你不知道是什么。' },
  { id: 'mirror', emoji: '🪞', label: '一面小镜子',   message: '镜子里没有人。' },
  { id: 'void',   emoji: '🌫️', label: '（什么都没有）', message: '但箱子似乎更重了。' },
];

/**
 * 从物品池中随机选取一个物品，保证与上一次不同
 * @param {string|null} lastItemId — 上一次弹出的物品 ID，null 表示首次
 * @returns {{ id: string, emoji: string, label: string, message: string }}
 */
export function pickItem(lastItemId) {
  const candidates = ITEMS.length === 1
    ? ITEMS
    : ITEMS.filter(item => item.id !== lastItemId);

  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

/** 获取物品池全部列表（供后续扩展用） */
export function getAllItems() {
  return ITEMS.slice();
}

export { ITEMS };
