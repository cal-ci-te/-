import { AdminAuth } from '../../auth.js';
import { Utils } from '../../../utils.js';

export function logout() {
  if (AdminAuth && AdminAuth.logout) {
    AdminAuth.logout();
  } else {
    Utils.showToast('退出失败，请刷新页面', true);
  }
}
