import { Article } from '../../models/article-model.js';
import { ArticleService } from '../../services/article-service.js';
import { AppState } from '../../core/app-state.js';
import { EventBus } from '../../core/event-bus.js';
import { EVENTS } from '../../core/event-constants.js';
import { Utils } from '../../utils.js';
import { UI } from '../../utils/ui-strings.js';

export const UIDetail = {
  overlay: null,
  tabsContainer: null,
  panesContainer: null,
  openArticles: [],
  activeId: null,
  minimizedContainer: null,
  isFullscreen: false,

  init: function () {
    this.overlay = document.getElementById('detailOverlay');
    this.tabsContainer = document.getElementById('detailTabs');
    this.panesContainer = document.getElementById('detailPanes');

    if (!this.overlay || !this.tabsContainer || !this.panesContainer) {
      console.warn('[UIDetail] 缺少必要元素，初始化中止');
      return;
    }

    // 构建浏览器式顶部栏：标签页在左，控件按钮在右
    this._buildTopbar();
    this._createMinimizedBar();

    this.overlay.addEventListener(
      'click',
      function (e) {
        if (e.target === this.overlay) this.closeAll();
      }.bind(this)
    );

    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
          this.closeAll();
        }
      }.bind(this)
    );

    document.addEventListener('fullscreenchange', this._onFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this._onFullscreenChange.bind(this));
    document.addEventListener('mozfullscreenchange', this._onFullscreenChange.bind(this));
    document.addEventListener('MSFullscreenChange', this._onFullscreenChange.bind(this));

    EventBus.on(
      EVENTS.ARTICLE_MADE_INVISIBLE,
      function (data) {
        const articleId = data.articleId;
        const entry = this.openArticles.find((item) => item.id === articleId);
        if (entry) {
          if (AppState.get('isLoggedIn')) {
            Utils.showToast(UI.detail.invisibleToast, false);
            return;
          }
          const confirmClose = confirm(UI.detail.invisibleConfirm);
          if (confirmClose) {
            this.closeTab(articleId);
          }
        }
      }.bind(this)
    );

    console.log('[UIDetail] 初始化完成（浏览器式顶部栏 + 最小化栏 + 全屏）');
  },

  _buildTopbar: function () {
    const container = this.tabsContainer.parentElement;
    // 用 detail-topbar 包裹 tabs + controls
    const topbar = document.createElement('div');
    topbar.className = 'detail-topbar';
    // 把原 tabsContainer 移入 topbar
    this.tabsContainer.parentElement.removeChild(this.tabsContainer);
    this.tabsContainer.classList.add('detail-tabs');
    topbar.appendChild(this.tabsContainer);

    // 右侧控件按钮
    const controls = document.createElement('div');
    controls.className = 'detail-topbar-controls';
    controls.innerHTML = `
      <button class="tb-minimize" title="${UI.detail.minimizeTitle}">${UI.detail.paneMinimize}</button>
      <button class="tb-fullscreen" title="${UI.detail.fullscreenTitle}">${UI.detail.paneFullscreen}</button>
      <button class="tb-close" title="${UI.common.close}">${UI.detail.paneClose}</button>
    `;
    topbar.appendChild(controls);

    // 插入回 detail-container 顶部
    container.insertBefore(topbar, container.firstChild);

    // 按钮事件绑定
    controls.querySelector('.tb-minimize').addEventListener('click', () => {
      if (this.activeId) this.minimizeTab(this.activeId);
    });
    controls.querySelector('.tb-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });
    controls.querySelector('.tb-close').addEventListener('click', () => {
      if (this.activeId) this.closeTab(this.activeId);
    });
  },

  _createMinimizedBar: function () {
    const bar = document.createElement('div');
    bar.id = 'minimized-bar';
    bar.className = 'minimized-bar';
    bar.style.display = 'none';
    document.body.appendChild(bar);
    this.minimizedContainer = bar;
  },

  openDetail: function (articleId) {
    let articles;
    if (typeof ArticleService !== 'undefined' && ArticleService.getAllArticles) {
      articles = ArticleService.getAllArticles();
    } else if (Article && Article.getAllArticles) {
      articles = Article.getAllArticles();
    } else {
      articles = Article.allArticles || [];
    }
    const article = articles.find((a) => a.id === articleId);
    if (!article) {
      Utils.showToast(UI.detail.articleNotFound, true);
      return;
    }

    this.createTab(article);
  },

  createTab: function (article) {
    const id = article.id;
    const title = article.title || UI.detail.defaultTitle;
    const rawContent = article.content || UI.detail.defaultContent;
    const html = this.renderContent(rawContent);

    const tab = document.createElement('button');
    tab.className = 'detail-tab';
    tab.dataset.id = id;
    tab.innerHTML = `
            <span class="tab-title">${Utils.escapeHtml(title)}</span>
            <span class="tab-close" data-id="${id}">${UI.detail.tabClose}</span>
        `;
    this.tabsContainer.appendChild(tab);

    const pane = document.createElement('div');
    pane.className = 'detail-pane';
    pane.dataset.id = id;
    pane.innerHTML = `
            <div class="detail-body">${html}</div>
        `;
    this.panesContainer.appendChild(pane);

    const entry = {
      id: id,
      title: title,
      tabElement: tab,
      paneElement: pane,
      isMinimized: false,
      minimizedItem: null,
    };
    this.openArticles.push(entry);

    tab.addEventListener(
      'click',
      function (e) {
        if (e.target.classList.contains('tab-close')) return;
        if (entry.isMinimized) this.restoreFromMinimize(id);
        this.activateTab(id);
      }.bind(this)
    );

    const closeBtn = tab.querySelector('.tab-close');
    closeBtn.addEventListener(
      'click',
      function (e) {
        e.stopPropagation();
        this.closeTab(id);
      }.bind(this)
    );

    this.activateTab(id);
    this.overlay.classList.add('active');
    document.documentElement.style.overflow = "hidden"; document.body.style.overflow = "hidden";
  },

  renderContent: function (text) {
    if (!text) return '';
    let html = Utils.escapeHtml(text);

    html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
      return '<pre><code>' + Utils.escapeHtml(code) + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\s*)+/g, function (match) {
      return '<ul>' + match + '</ul>';
    });
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br><\/p>/g, '');
    html = html.replace(/<(h[1-6]|ul|ol|li|blockquote|pre)>/g, function (match) {
      return match.replace('<br>', '');
    });
    return html;
  },

  activateTab: function (id) {
    this.activeId = id;
    this.openArticles.forEach(function (item) {
      if (item.id === id) {
        item.tabElement.classList.add('active');
        if (!item.isMinimized) {
          item.paneElement.classList.add('active');
        } else {
          item.paneElement.classList.remove('active');
        }
      } else {
        item.tabElement.classList.remove('active');
        item.paneElement.classList.remove('active');
      }
    });
  },

  minimizeTab: function (id) {
    const entry = this.openArticles.find((item) => item.id === id);
    if (!entry || entry.isMinimized) return;

    entry.isMinimized = true;
    entry.paneElement.classList.remove('active');

    this._addToMinimizedBar(entry);
    Utils.showToast(UI.detail.minimizeToast, false);

    const next = this.openArticles.find((item) => !item.isMinimized && item.id !== id);
    if (next) {
      this.activateTab(next.id);
    } else {
      this.overlay.classList.remove('active');
      document.documentElement.style.overflow = ''; document.body.style.overflow = '';
      this.activeId = null;
    }
  },

  _addToMinimizedBar: function (entry) {
    const bar = this.minimizedContainer;
    if (!bar) return;
    bar.style.display = 'flex';

    const item = document.createElement('div');
    item.className = 'minimized-item';
    item.dataset.id = entry.id;
    item.innerHTML = `
            <span class="minimized-title">${Utils.escapeHtml(entry.title)}</span>
            <span class="minimized-restore" data-id="${entry.id}">${UI.detail.restoreFromMinimize}</span>
            <span class="minimized-close" data-id="${entry.id}">${UI.detail.paneClose}</span>
        `;
    bar.appendChild(item);
    entry.minimizedItem = item;

    item.querySelector('.minimized-title').addEventListener(
      'click',
      function () {
        this.restoreFromMinimize(entry.id);
      }.bind(this)
    );
    item.querySelector('.minimized-restore').addEventListener(
      'click',
      function (e) {
        e.stopPropagation();
        this.restoreFromMinimize(entry.id);
      }.bind(this)
    );
    item.querySelector('.minimized-close').addEventListener(
      'click',
      function (e) {
        e.stopPropagation();
        this.closeTab(entry.id);
      }.bind(this)
    );

    bar.scrollLeft = bar.scrollWidth;
  },

  restoreFromMinimize: function (id) {
    const entry = this.openArticles.find((item) => item.id === id);
    if (!entry || !entry.isMinimized) return;

    entry.isMinimized = false;
    if (entry.minimizedItem) {
      entry.minimizedItem.remove();
      entry.minimizedItem = null;
    }
    if (this.minimizedContainer && this.minimizedContainer.children.length === 0) {
      this.minimizedContainer.style.display = 'none';
    }

    entry.paneElement.classList.add('active');
    this.activateTab(id);
    this.overlay.classList.add('active');
    document.documentElement.style.overflow = "hidden"; document.body.style.overflow = "hidden";
  },

  toggleFullscreen: function () {
    const isFullscreen = !!(document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement);
    if (isFullscreen) {
      this._exitFullscreen();
    } else {
      this._requestFullscreen();
    }
    this._updateFullscreenButtons();
  },

  _requestFullscreen: function () {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  },

  _exitFullscreen: function () {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  },

  _onFullscreenChange: function () {
    this._updateFullscreenButtons();
  },

  _updateFullscreenButtons: function () {
    const isFullscreen = !!(document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement);
    const btns = document.querySelectorAll('.pane-fullscreen');
    btns.forEach(function (btn) {
      btn.textContent = isFullscreen ? UI.detail.paneFullscreenExit : UI.detail.paneFullscreen;
      btn.title = isFullscreen ? UI.detail.fullscreenTitle : UI.detail.fullscreenTitle;
    });
  },

  closeTab: function (id) {
    const index = this.openArticles.findIndex((item) => item.id === id);
    if (index === -1) return;
    const entry = this.openArticles[index];

    if (entry.minimizedItem) {
      entry.minimizedItem.remove();
      entry.minimizedItem = null;
    }
    entry.tabElement.remove();
    entry.paneElement.remove();
    this.openArticles.splice(index, 1);

    if (this.minimizedContainer && this.minimizedContainer.children.length === 0) {
      this.minimizedContainer.style.display = 'none';
    }

    if (this.openArticles.length > 0) {
      const next = this.openArticles.find((item) => !item.isMinimized);
      if (next) {
        this.activateTab(next.id);
      } else {
        this.overlay.classList.remove('active');
        document.documentElement.style.overflow = ''; document.body.style.overflow = '';
        this.activeId = null;
      }
    } else {
      this.overlay.classList.remove('active');
      document.documentElement.style.overflow = ''; document.body.style.overflow = '';
      this.activeId = null;
      if (document.fullscreenElement) this._exitFullscreen();
    }
  },

  closeAll: function () {
    while (this.openArticles.length > 0) {
      const item = this.openArticles[0];
      if (item.minimizedItem) item.minimizedItem.remove();
      item.tabElement.remove();
      item.paneElement.remove();
      this.openArticles.splice(0, 1);
    }
    if (this.minimizedContainer) {
      this.minimizedContainer.innerHTML = '';
      this.minimizedContainer.style.display = 'none';
    }
    this.overlay.classList.remove('active');
    document.documentElement.style.overflow = ''; document.body.style.overflow = '';
    this.activeId = null;
    if (document.fullscreenElement) this._exitFullscreen();
  },
};

