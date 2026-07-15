// ========== HTTP API 客户端 ==========
import { CONFIG } from '../config.js';

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const ApiClient = {
  // + 拦截器存储
  _requestInterceptors: [],
  _responseInterceptors: [],

  // + 注册请求拦截器（接收 config，返回 config 或 Promise<config>）
  useRequestInterceptor(handler) {
    this._requestInterceptors.push(handler);
  },

  // + 注册响应拦截器（成功和失败两个回调）
  useResponseInterceptor(onFulfilled, onRejected) {
    this._responseInterceptors.push({ onFulfilled, onRejected });
  },

  async request(endpoint, options = {}) {
    // + 执行请求拦截器
    let config = { endpoint, options };
    for (const interceptor of this._requestInterceptors) {
      config = await interceptor(config);
    }

    const { endpoint: finalEndpoint, options: finalOptions } = config;
    const baseUrl = CONFIG.API_BASE_URL || '';
    const url = baseUrl + finalEndpoint;

    const defaultOptions = {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };

    const headers = { ...defaultOptions.headers, ...finalOptions.headers };
    if (finalOptions.body && finalOptions.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const fetchOptions = {
      ...defaultOptions,
      ...finalOptions,
      headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const message = data?.message || data || `HTTP ${response.status}`;
        throw new ApiError(response.status, message, data);
      }

      // + 执行成功响应拦截器
      for (const interceptor of this._responseInterceptors) {
        if (interceptor.onFulfilled) {
          data = await interceptor.onFulfilled(data, response);
        }
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        error = new ApiError(408, '请求超时，请检查网络连接');
      }
      // + 执行失败响应拦截器
      for (const interceptor of this._responseInterceptors) {
        if (interceptor.onRejected) {
          error = await interceptor.onRejected(error);
        }
      }
      throw error;
    }
  },

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint, data, options = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    const headers = data instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      headers: { ...headers, ...options.headers },
      body,
    });
  },

  put(endpoint, data, options = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    const headers = data instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      headers: { ...headers, ...options.headers },
      body,
    });
  },

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },
};