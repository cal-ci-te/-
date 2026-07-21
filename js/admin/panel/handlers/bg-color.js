import { Texture } from '../../../services/texture.js';
import { Utils } from '../../../utils.js';

export function applyBgColor() {
  const picker = document.getElementById('bgColorPicker');
  if (!picker) return;
  const color = picker.value;
  if (Texture && Texture.setBgColor) {
    Texture.setBgColor(color);
    const preview = document.getElementById('bgColorPreview');
    if (preview) preview.style.backgroundColor = color;
    Utils.showToast('背景颜色已应用', false);
    Utils.storage.set('bg_color', color);
  } else {
    Utils.showToast('纹理模块未加载', true);
  }
}

export function resetBgColor() {
  if (Texture && Texture.resetBgColor) {
    Texture.resetBgColor();
    const picker = document.getElementById('bgColorPicker');
    const preview = document.getElementById('bgColorPreview');
    if (picker) picker.value = '#1a1612'; // → var(--color-bg-primary), color picker 需 hex
    if (preview) preview.style.backgroundColor = '#1a1612'; // → var(--color-bg-primary)
    Utils.showToast('背景颜色已重置', false);
  } else {
    Utils.showToast('纹理模块未加载', true);
  }
}
