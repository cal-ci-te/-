import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';

export const Watermark = {
  config: {
    text: CONFIG.watermarkDefaults.text,
    opacity: CONFIG.watermarkDefaults.opacity,
  },

  getVisitorId() {
    let visitorId = Utils.storage.get('visitor_id');
    if (!visitorId) {
      const date = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      const random = Math.random().toString(36).substring(2, 10);
      let screenInfo = 'unknown';
      try {
        if (typeof screen !== 'undefined' && screen.width) {
          screenInfo = `${screen.width}x${screen.height}`;
        }
      } catch (e) {
        screenInfo = 'unknown';
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      visitorId = `${date}_${random}_${screenInfo}_${timezone}`;
      Utils.storage.set('visitor_id', visitorId);
    }
    return visitorId;
  },

  generateTiledWatermark(text, opacity) {
    if (!text || text.trim() === '') text = 'REVACHOL';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 150;
    ctx.font = 'bold 20px "Special Elite", "Courier New", monospace';
    ctx.fillStyle = `rgba(196, 122, 68, ${opacity})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.font = 'bold 16px "Special Elite", "Courier New", monospace';
    ctx.fillStyle = `rgba(196, 122, 68, ${opacity * 0.7})`;
    ctx.fillText('©', canvas.width - 30, canvas.height - 20);
    const dataUrl = canvas.toDataURL();
    const watermarkDiv = document.getElementById('tiledWatermark');
    if (watermarkDiv) {
      watermarkDiv.style.backgroundImage = `url(${dataUrl})`;
      watermarkDiv.style.opacity = '1';
    }
  },

  addZeroWidthWatermark(text, articleId) {
    if (!CONFIG.protection.enableWatermark || !text) return text;
    const visitorId = this.getVisitorId();
    const fullWatermark = `${visitorId}|article:${articleId}|${new Date().toISOString()}`;
    let watermark = '';
    for (let i = 0; i < fullWatermark.length; i++) {
      const code = fullWatermark.charCodeAt(i);
      for (let bit = 0; bit < 16; bit++) {
        if (code & (1 << bit)) {
          watermark += '\u200B';
        } else {
          watermark += '\u200C';
        }
      }
      watermark += '\u200D';
    }
    return text + watermark;
  },

  updateVisibleWatermark() {
    const watermarkEl = document.getElementById('visibleWatermark');
    if (watermarkEl && CONFIG.protection.enableWatermark) {
      const shortId = this.getVisitorId().substring(0, 12);
      watermarkEl.innerHTML = `© ${this.config.text} · ${shortId} · 内容受保护`;
    }
  },

  updateWatermark() {
    this.generateTiledWatermark(this.config.text, this.config.opacity);
    Utils.storage.set('watermark_config', this.config);
  },

  loadConfig() {
    const saved = Utils.storage.get('watermark_config');
    if (saved) {
      this.config = { ...this.config, ...saved };
    }
    this.updateWatermark();
    this.updateVisibleWatermark();
  },

  apply(text, opacity) {
    if (text !== undefined) this.config.text = text;
    if (opacity !== undefined) this.config.opacity = opacity;
    this.updateWatermark();
    this.updateVisibleWatermark();
  },
};

console.log('✅ Watermark 已加载 (ES Module)');
