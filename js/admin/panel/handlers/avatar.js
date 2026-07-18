import { AdminAvatar } from '../../avatar.js';
import { Utils } from '../../../utils.js';

export function uploadAvatar() {
  console.log('[AdminPanel] 点击上传头像按钮');
  try {
    if (AdminAvatar && typeof AdminAvatar.openUpload === 'function') {
      AdminAvatar.openUpload();
    } else {
      console.warn('[AdminPanel] AdminAvatar.openUpload 不可用');
      Utils.showToast('头像模块未加载，请刷新页面重试', true);
    }
  } catch (error) {
    console.error('[AdminPanel] 头像上传出错:', error);
    Utils.showToast('操作失败: ' + error.message, true);
  }
}
