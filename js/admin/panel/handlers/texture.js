// ========== 纹理处理器 ==========
import { Texture } from '../../../services/texture.js';
import { Utils } from '../../../utils.js';

export function textureUpload(event) {
  const file = event.target.files[0];
  if (file) {
    if (Texture && Texture.uploadTexture) {
      Texture.uploadTexture(file);
    } else {
      Utils.showToast('纹理模块未加载', true);
    }
    event.target.value = '';
  }
}

export function applyTexture() {
  if (!Texture) {
    Utils.showToast('纹理模块未加载', true);
    return;
  }
  if (!Texture.textureConfig || !Texture.textureConfig.dataUrl) {
    Utils.showToast('请先上传纹理图片', true);
    return;
  }
  if (Texture.saveConfig) {
    Texture.saveConfig();
    const size = (Texture.textureConfig.dataUrl.length / 1024).toFixed(1);
    Utils.showToast(`纹理已应用（WebP格式，${size}KB）`, false);
  }
}

export function resetTexture() {
  if (Texture && Texture.removeTexture) {
    Texture.removeTexture();
    Utils.showToast('纹理已移除', false);
  } else {
    Utils.showToast('纹理模块未加载', true);
  }
}

export function textureOpacity(event) {
  const val = parseFloat(event.target.value);
  const valueDisplay = document.getElementById('textureOpacityValue');
  if (valueDisplay) valueDisplay.innerText = val.toFixed(2);
  if (Texture && Texture.setOpacity) {
    Texture.setOpacity(val);
  }
}
