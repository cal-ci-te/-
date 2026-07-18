// HTTP API 客户端。支持请求/响应拦截器链，自动超时（10s），JSON/FormData 自动处理。
// 选择自研 fetch 封装而非 Axios：项目仅 ~10 个 API 端点，Axios (~30KB) 的拦截器/取消/进度等功能
// 在此项目场景中均为冗余。拦截器模式保留了未来切换为 Axios 的接口兼容性。
import { CONFIG } from '../config.js';

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.name = 'ApiError'; this.status = status; this.data = data; }
}

export const ApiClient = {
  _requestInterceptors: [],
  _responseInterceptors: [],

  useRequestInterceptor(handler) { this._requestInterceptors.push(handler); },
  useResponseInterceptor(onFulfilled, onRejected) { this._responseInterceptors.push({ onFulfilled, onRejected }); },

  async request(endpoint, options = {}) {
    let config = { endpoint, options };
    for (const interceptor of this._requestInterceptors) { config = await interceptor(config); }

    const { endpoint: finalEndpoint, options: finalOptions } = config;
    const url = (CONFIG.API_BASE_URL || '') + finalEndpoint;

    const headers = { 'Content-Type': 'application/json', ...finalOptions.headers };
    if (finalOptions.body instanceof FormData) delete headers['Content-Type'];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, { credentials: 'include', ...finalOptions, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      let data = (response.headers.get('content-type') || '').includes('application/json')
        ? await response.json() : await response.text();
      if (!response.ok) throw new ApiError(response.status, data?.message || data || `HTTP ${response.status}`, data);

      for (const interceptor of this._responseInterceptors) {
        if (interceptor.onFulfilled) data = await interceptor.onFulfilled(data, response);
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') error = new ApiError(408, '请求超时，请检查网络连接');
      for (const interceptor of this._responseInterceptors) {
        if (interceptor.onRejected) error = await interceptor.onRejected(error);
      }
      throw error;
    }
  },

  get(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'GET' }); },
  post(endpoint, data, options = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { ...options, method: 'POST', body });
  },
  put(endpoint, data, options = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { ...options, method: 'PUT', body });
  },
  delete(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'DELETE' }); },
};
