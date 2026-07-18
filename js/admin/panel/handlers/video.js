import { HeroBackground } from '../../../services/hero-background.js';
import { Utils } from '../../../utils.js';

export function videoOpacity(event) {
  const val = parseFloat(event.target.value);
  const valueDisplay = document.getElementById('videoMaxOpacityValue');
  if (valueDisplay) valueDisplay.innerText = val.toFixed(2);
  console.log('[AdminPanel] 视频透明度滑块变化:', val);
  if (HeroBackground && typeof HeroBackground.setMaxOpacity === 'function') {
    HeroBackground.setMaxOpacity(val);
  } else {
    // 降级：保存到存储并直接修改背景透明度
    Utils.storage.set('video_max_opacity', val);
    const bg = document.getElementById('fullscreenBg');
    if (bg) bg.style.opacity = val;
    console.warn('[AdminPanel] HeroBackground 未加载，直接修改 DOM');
  }
}
