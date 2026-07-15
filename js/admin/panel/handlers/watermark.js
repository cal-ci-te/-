// ========== 水印处理器 ==========
import { Watermark } from '../../../services/watermark.js';
import { Utils } from '../../../utils.js';

export function applyWatermark() {
  const textInput = document.getElementById('watermarkTextInput');
  const opacitySlider = document.getElementById('watermarkOpacitySlider');
  const newText = textInput ? textInput.value.trim() : 'REVACHOL';
  const newOpacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.08;
  if (Watermark && Watermark.apply) {
    Watermark.apply(newText, newOpacity);
    Utils.showToast('水印设置已应用', false);
  } else {
    Utils.showToast('水印模块未加载', true);
  }
}

export function watermarkOpacity(event) {
  const val = parseFloat(event.target.value);
  const valueDisplay = document.getElementById('opacityValue');
  if (valueDisplay) valueDisplay.innerText = val.toFixed(2);
}
