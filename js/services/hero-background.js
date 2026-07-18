// 全屏视频背景：首次加载后 opacity 缓动到 maxOpacity（管理员可调），
// 背景色作为视频未加载时的后备。视频格式优先 WebM（体积更小），其次 MP4。
import { Utils } from '../utils.js';

export const HeroBackground = {
  bgElement: null,
  videoElement: null,
  heroSection: null,
  isVisible: true,
  maxOpacity: 1,
  _throttledUpdate: null,

  init() {
    this.bgElement = document.getElementById('fullscreenBg');
    this.videoElement = document.getElementById('heroVideo');
    this.heroSection = document.querySelector('.hero-section');

    if (!this.bgElement || !this.heroSection) {
      console.warn('[HeroBackground] 缺少必要元素，初始化中止');
      return;
    }
    console.log('[HeroBackground] 初始化成功');

    this.loadConfig();

    // 初始设置透明度为 maxOpacity（首屏完全可见）
    this.bgElement.style.opacity = this.maxOpacity;

    this._throttledUpdate = this._throttle(this.updateOpacity.bind(this), 16);
    window.addEventListener('scroll', this._throttledUpdate);
    window.addEventListener('resize', this._throttledUpdate);

    // 确保滚动时更新
    setTimeout(() => this.updateOpacity(), 50);

    document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
  },

  loadConfig() {
    const saved = Utils.storage.get('video_max_opacity');
    if (saved !== null && typeof saved === 'number') {
      this.maxOpacity = Math.max(0, Math.min(1, saved));
    } else {
      this.maxOpacity = 1;
    }
    console.log('[HeroBackground] 加载最大透明度配置:', this.maxOpacity);
  },

  saveConfig() {
    Utils.storage.set('video_max_opacity', this.maxOpacity);
  },

  setMaxOpacity(value) {
    this.maxOpacity = Math.max(0, Math.min(1, value));
    this.saveConfig();
    // 立即更新背景透明度
    if (this.bgElement) {
      this.bgElement.style.opacity = this.maxOpacity;
    }
    this.updateOpacity(); // 重新计算滚动影响
    console.log('[HeroBackground] 最大透明度已设置为:', this.maxOpacity);
  },

  updateOpacity() {
    if (!this.heroSection || !this.bgElement) return;
    const rect = this.heroSection.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const visibleHeight = Math.max(0, Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0));
    const totalHeight = rect.height;
    let visibleRatio = totalHeight > 0 ? visibleHeight / totalHeight : 0;
    visibleRatio = Math.max(0, Math.min(1, visibleRatio));

    // 如果首屏完全可见，直接使用 maxOpacity，否则按比例缩小
    let opacity;
    if (visibleRatio >= 0.99) {
      opacity = this.maxOpacity;
    } else {
      // 当滚动离开首屏时，透明度从 maxOpacity 逐渐降到 0
      opacity = visibleRatio * this.maxOpacity;
    }
    this.bgElement.style.opacity = opacity;

    // 视频播放控制
    if (visibleRatio === 0 && this.isVisible) {
      this.isVisible = false;
      if (this.videoElement && !this.videoElement.paused) {
        this.videoElement.pause();
      }
    } else if (visibleRatio > 0 && !this.isVisible) {
      this.isVisible = true;
      if (this.videoElement && this.videoElement.paused) {
        this.videoElement.play().catch(() => {});
      }
    }
  },

  _handleVisibilityChange() {
    if (document.hidden) {
      if (this.videoElement && !this.videoElement.paused) {
        this.videoElement.pause();
      }
    } else {
      if (this.isVisible && this.videoElement && this.videoElement.paused) {
        this.videoElement.play().catch(() => {});
      }
    }
  },

  _throttle(fn, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  },
};
