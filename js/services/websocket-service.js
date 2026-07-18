import { CONFIG } from '../config.js';
import { ArticleService } from './article-service.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { UIController } from '../ui/ui-controller.js';

export const WebSocketManager = {
  ws: null,
  reconnectTimer: null,
  reconnectInterval: 3000,
  isConnected: false,

  init() {
    const wsUrl = CONFIG.WS_URL;
    if (!wsUrl) {
      console.log('[WebSocket] WS_URL 未配置，跳过连接');
      return;
    }
    this.connect(wsUrl);
  },

  connect(url) {
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
    } catch (e) {
      console.error('[WebSocket] 连接失败:', e);
      this.scheduleReconnect();
    }
  },

  onOpen() {
    console.log('[WebSocket] 已连接');
    this.isConnected = true;
    this.send({ type: 'subscribe', channel: 'visibility' });
  },

  onMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('[WebSocket] 收到消息:', data.type, data.payload);

      if (data.type === 'visibility_changed') {
        // ★★★ 改为调用 ArticleService ★★★
        if (typeof ArticleService !== 'undefined' && ArticleService.onVisibilityChanged) {
          ArticleService.onVisibilityChanged(data);
        }
      } else if (data.type === 'article_updated') {
        console.log('[WebSocket] 文章更新:', data.payload);
        if (ArticleService && ArticleService.fetchArticles) {
          ArticleService.fetchArticles(true).then(() => {
            if (UIController && UIController.refreshDisplay) {
              UIController.refreshDisplay();
            }
            EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
          });
        }
      } else if (data.type === 'article_created' || data.type === 'article_deleted') {
        if (ArticleService && ArticleService.fetchArticles) {
          ArticleService.fetchArticles(true).then(() => {
            if (UIController && UIController.refreshDisplay) {
              UIController.refreshDisplay();
            }
            EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
          });
        }
      }
    } catch (e) {
      console.error('[WebSocket] 消息解析错误:', e);
    }
  },

  onClose() {
    console.log('[WebSocket] 连接断开');
    this.isConnected = false;
    this.scheduleReconnect();
  },

  onError(error) {
    console.error('[WebSocket] 错误:', error);
  },

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] 未连接，无法发送消息');
    }
  },

  scheduleReconnect() {
    // 如果 WS_URL 未配置，不进行重连
    if (!CONFIG.WS_URL) {
        console.log('[WebSocket] WS_URL 未配置，跳过重连');
        return;
    }
    
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
        console.log('[WebSocket] 尝试重连...');
        this.connect(CONFIG.WS_URL);
    }, this.reconnectInterval);
},

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  },
};

