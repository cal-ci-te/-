// ========== 渐变控制处理器 ==========
import { Texture } from '../../../services/texture.js';
import { Utils } from '../../../utils.js';
import { AdminPanel } from '../index.js';

export function bgMode(event) {
  const gradControls = document.getElementById('gradientControls');
  if (event.target.value === 'gradient') {
    if (gradControls) gradControls.style.display = 'block';
  } else {
    if (gradControls) gradControls.style.display = 'none';
  }
}

export function gradDirection(event) {
  Texture.setDirection(event.target.value);
}

export function gradFeather(event) {
  const val = parseInt(event.target.value);
  const valueDisplay = document.getElementById('gradFeatherValue');
  if (valueDisplay) valueDisplay.textContent = val;
  Texture.setFeather(val);
}

export function applyGradient() {
  const colors = [];
  const c1 = document.getElementById('gradColor1');
  const c2 = document.getElementById('gradColor2');
  const c3 = document.getElementById('gradColor3');
  if (c1) colors.push(c1.value);
  if (c2) colors.push(c2.value);
  if (c3 && c3.style.display !== 'none') colors.push(c3.value);
  if (colors.length < 2) {
    Utils.showToast('请至少选择两种颜色', true);
    return;
  }
  const dir = document.getElementById('gradDirection');
  const feather = document.getElementById('gradFeatherSlider');
  if (Texture && Texture.setGradient) {
    Texture.setGradient(
      colors,
      dir ? dir.value : 'to bottom',
      feather ? parseInt(feather.value) : 50
    );
    const gradientRadio = document.querySelector('input[name="bgMode"][value="gradient"]');
    if (gradientRadio) gradientRadio.checked = true;
    const gradControls = document.getElementById('gradientControls');
    if (gradControls) gradControls.style.display = 'block';
    if (AdminPanel.renderPalettes) AdminPanel.renderPalettes();
  } else {
    Utils.showToast('纹理模块未加载', true);
  }
}

export function savePalette() {
  const colors = [];
  const c1 = document.getElementById('gradColor1');
  const c2 = document.getElementById('gradColor2');
  const c3 = document.getElementById('gradColor3');
  if (c1) colors.push(c1.value);
  if (c2) colors.push(c2.value);
  if (c3 && c3.style.display !== 'none') colors.push(c3.value);
  if (colors.length < 1) {
    Utils.showToast('请至少选择一种颜色', true);
    return;
  }
  const mode = colors.length === 1 ? 'solid' : 'gradient';
  const dir = document.getElementById('gradDirection');
  const feather = document.getElementById('gradFeatherSlider');
  const nameInput = document.getElementById('paletteNameInput');
  let name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    name = mode === 'solid' ? `纯色 ${colors[0]}` : `渐变 ${colors.join('-')}`;
  }
  if (Texture && Texture.addPalette) {
    Texture.addPalette(
      name,
      mode,
      colors,
      dir ? dir.value : 'to bottom',
      feather ? parseInt(feather.value) : 50
    );
    if (nameInput) nameInput.value = '';
    Utils.showToast('色卡已保存', false);
    if (AdminPanel.renderPalettes) AdminPanel.renderPalettes();
  } else {
    Utils.showToast('纹理模块未加载', true);
  }
}
