// ========== 纹理与背景模块（支持渐变 + 主题模式兼容） ==========
import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';

export const Texture = {
  // 纯色背景
  bgColor: '#1a1612',

  // 渐变背景配置
  bgMode: 'solid',
  gradientColors: ['#1a1612', '#2a231c'],
  gradientDirection: 'to bottom',
  gradientFeather: 50,

  // 纹理
  textureConfig: { dataUrl: null, opacity: 0.12 },

  // 色卡库
  palettes: [],

  // ===== 主题模式标志 =====
  _themeActive: false,

  // ===== 初始化 =====
  loadConfig() {
    const savedBg = Utils.storage.get('bg_color');
    if (savedBg) this.bgColor = savedBg;

    const grad = Utils.storage.get('gradient_config');
    if (grad) {
      this.bgMode = grad.mode || 'solid';
      this.gradientColors = grad.colors || ['#1a1612', '#2a231c'];
      this.gradientDirection = grad.direction || 'to bottom';
      this.gradientFeather = grad.feather !== undefined ? grad.feather : 50;
    }

    const pal = Utils.storage.get('palettes');
    if (pal && Array.isArray(pal)) {
      this.palettes = pal;
    } else {
      this.palettes = [
        {
          id: 'default',
          name: '默认暗色',
          mode: 'solid',
          colors: ['#1a1612'],
          direction: 'to bottom',
          feather: 50,
        },
      ];
      this.savePalettes();
    }

    // ===== 主题模式下不应用背景 =====
    if (!this._themeActive) {
      this.applyBackground();
    } else {
      console.log('[Texture] 主题模式已激活，跳过背景应用');
    }

    const tex = Utils.storage.get('texture_config');
    if (tex) {
      this.textureConfig = tex;
      this.applyTexture();
    }
  },

  // ===== 设置主题模式 =====
  setThemeMode(active) {
    this._themeActive = active;
    if (active) {
      // 清除内联背景样式，让 CSS 控制
      document.body.style.background = '';
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
      document.body.style.backgroundBlendMode = '';
      console.log('[Texture] 主题模式已启用，背景由 CSS 控制');
    } else {
      // 恢复背景应用（用户自定义）
      this.applyBackground();
      console.log('[Texture] 主题模式已禁用，恢复 Texture 背景控制');
    }
  },

  // ===== 背景应用 =====
  applyBackground() {
    if (this._themeActive) {
      console.log('[Texture] 主题模式已激活，跳过背景应用');
      return;
    }
    if (this.bgMode === 'solid') {
      document.body.style.background = this.bgColor;
    } else {
      const gradientCSS = this.buildGradientCSS();
      document.body.style.background = gradientCSS;
    }
    this.saveBgConfig();
  },

  // ===== 构建渐变CSS =====
  buildGradientCSS() {
    const colors = this.gradientColors;
    if (colors.length < 2) {
      return colors[0] || '#1a1612';
    }

    const dir = this.gradientDirection;
    const feather = this.gradientFeather / 100;
    let stops = [];
    const count = colors.length;

    if (count === 2) {
      const mid = 0.5;
      const offset = feather * 0.4;
      const p1 = Math.max(0, mid - offset);
      const p2 = Math.min(1, mid + offset);
      stops = [
        `${colors[0]} 0%`,
        `${colors[0]} ${p1 * 100}%`,
        `${colors[1]} ${p2 * 100}%`,
        `${colors[1]} 100%`,
      ];
    } else if (count === 3) {
      const mid1 = 1 / 3;
      const mid2 = 2 / 3;
      const offset = feather * 0.3;
      const p1 = Math.max(0, mid1 - offset);
      const p2 = Math.min(1, mid1 + offset);
      const p3 = Math.max(0, mid2 - offset);
      const p4 = Math.min(1, mid2 + offset);
      stops = [
        `${colors[0]} 0%`,
        `${colors[0]} ${p1 * 100}%`,
        `${colors[1]} ${p2 * 100}%`,
        `${colors[1]} ${p3 * 100}%`,
        `${colors[2]} ${p4 * 100}%`,
        `${colors[2]} 100%`,
      ];
    } else {
      stops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`);
    }

    return `linear-gradient(${dir}, ${stops.join(', ')})`;
  },

  // ===== 保存背景配置 =====
  saveBgConfig() {
    Utils.storage.set('bg_color', this.bgColor);
    Utils.storage.set('gradient_config', {
      mode: this.bgMode,
      colors: this.gradientColors,
      direction: this.gradientDirection,
      feather: this.gradientFeather,
    });
  },

  // ===== 设置纯色 =====
  setBgColor(color) {
    if (this._themeActive) {
      console.log('[Texture] 主题模式已激活，请先退出主题模式再设置背景');
      return;
    }
    this.bgColor = color;
    this.bgMode = 'solid';
    this.applyBackground();
    Utils.showToast(UI.toast.textureSolidColorApplied, false);
  },

  resetBgColor() {
    if (this._themeActive) {
      console.log('[Texture] 主题模式已激活，请先退出主题模式再重置背景');
      return;
    }
    this.bgColor = CONFIG.bgColorDefault || '#1a1612';
    this.bgMode = 'solid';
    this.applyBackground();
    Utils.showToast(UI.toast.textureBgReset, false);
  },

  // ===== 设置渐变 =====
  setGradient(colors, direction, feather) {
    if (this._themeActive) {
      console.log('[Texture] 主题模式已激活，请先退出主题模式再设置渐变');
      return;
    }
    if (!colors || colors.length < 2) {
      Utils.showToast(UI.toast.textureNeedAtLeastTwoColors, true);
      return;
    }
    this.bgMode = 'gradient';
    this.gradientColors = colors.slice(0, 3);
    if (direction) this.gradientDirection = direction;
    if (feather !== undefined) this.gradientFeather = Math.max(0, Math.min(100, feather));
    this.applyBackground();
    Utils.showToast(UI.toast.textureGradientApplied, false);
  },

  // ===== 羽化值更新 =====
  setFeather(value) {
    this.gradientFeather = Math.max(0, Math.min(100, value));
    if (this.bgMode === 'gradient' && !this._themeActive) {
      this.applyBackground();
    }
    this.saveBgConfig();
  },

  // ===== 方向更新 =====
  setDirection(direction) {
    this.gradientDirection = direction;
    if (this.bgMode === 'gradient' && !this._themeActive) {
      this.applyBackground();
    }
    this.saveBgConfig();
  },

  // ===== 色卡管理 =====
  savePalettes() {
    Utils.storage.set('palettes', this.palettes);
  },

  addPalette(name, mode, colors, direction, feather) {
    const id = 'palette_' + Date.now();
    const entry = {
      id,
      name: name || '未命名色卡',
      mode: mode || 'solid',
      colors: colors || ['#1a1612'],
      direction: direction || 'to bottom',
      feather: feather !== undefined ? feather : 50,
    };
    this.palettes.push(entry);
    this.savePalettes();
    Utils.showToast(UI.toast.texturePaletteSaved, false);
    return entry;
  },

  deletePalette(id) {
    const idx = this.palettes.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.palettes.splice(idx, 1);
    this.savePalettes();
    Utils.showToast(UI.toast.texturePaletteDeleted, false);
    return true;
  },

  applyPalette(id) {
    if (this._themeActive) {
      console.log('[Texture] 主题模式已激活，请先退出主题模式再应用色卡');
      return;
    }
    const palette = this.palettes.find((p) => p.id === id);
    if (!palette) {
      Utils.showToast(UI.toast.texturePaletteNotFound, true);
      return;
    }
    if (palette.mode === 'solid') {
      this.setBgColor(palette.colors[0] || '#1a1612');
    } else {
      this.setGradient(palette.colors, palette.direction, palette.feather);
    }
    Utils.showToast(`已应用色卡：${palette.name}`, false);
  },

  // ===== 纹理 =====
  applyTexture() {
    const textureDiv = document.getElementById('customTexture');
    if (!textureDiv) return;
    if (this.textureConfig.dataUrl) {
      textureDiv.style.backgroundImage = `url(${this.textureConfig.dataUrl})`;
      textureDiv.style.backgroundSize = 'cover';
      textureDiv.style.backgroundPosition = 'center';
      textureDiv.style.backgroundRepeat = 'no-repeat';
      textureDiv.style.opacity = this.textureConfig.opacity;
    } else {
      textureDiv.style.backgroundImage = 'none';
    }
  },

  async uploadTexture(file) {
    try {
      Utils.showToast(UI.toast.textureCompressingImage, false);
      const result = await this.compressAndConvertToWebP(file, 0.85);
      this.textureConfig.dataUrl = result.dataUrl;
      this.applyTexture();
      this.saveConfig();
      Utils.showToast(`纹理已应用（WebP格式，${(result.size / 1024).toFixed(1)}KB）`, false);
    } catch (err) {
      Utils.showToast(UI.toast.textureImageProcessingFailed(err.message), true);
    }
  },

  removeTexture() {
    this.textureConfig.dataUrl = null;
    this.applyTexture();
    this.saveConfig();
    Utils.showToast(UI.toast.textureTextureRemoved, false);
  },

  setOpacity(opacity) {
    this.textureConfig.opacity = opacity;
    this.applyTexture();
    this.saveConfig();
  },

  saveConfig() {
    Utils.storage.set('texture_config', this.textureConfig);
  },

  // 图片压缩辅助
  compressAndConvertToWebP(file, quality) {
    return new Promise((resolve, reject) => {
      if (!file.type.match(/image\/(png|jpeg|jpg|webp)/)) {
        reject(new Error('只支持 PNG、JPG、WebP 格式'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxWidth = 1200;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve({
                blob: blob,
                dataUrl: URL.createObjectURL(blob),
                width: width,
                height: height,
                size: blob.size,
              });
            },
            'image/webp',
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

// 自动加载（但此时 _themeActive 默认为 false，所以会应用背景）
// 我们将在 ThemeService 初始化时设置为 true
Texture.loadConfig();

console.log('✅ Texture 已加载 (ES Module)');
