// ========== 编辑位置确认/取消处理器 ==========
import { DecoShelf } from '../../../services/deco.js';
import { Utils } from '../../../utils.js';

export function confirmEditPos() {
  if (DecoShelf && DecoShelf.confirmEditing) {
    DecoShelf.confirmEditing();
  } else {
    Utils.showToast('模块未加载', true);
  }
}

export function cancelEditPos() {
  if (DecoShelf && DecoShelf.cancelEditing) {
    DecoShelf.cancelEditing();
  } else {
    Utils.showToast('模块未加载', true);
  }
}
