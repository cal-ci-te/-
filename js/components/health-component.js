// 健康监控组件适配器
// 将 HealthMonitor 包装为 ComponentManager 标准组件。
// init: 初始化监控指示器。mount: 启动自动轮询。unmount: 停止轮询并清理。
import { HealthMonitor } from '../services/health-monitor.js';

export var healthComponent = {
  name: 'health',

  config: {
    dependencies: [],
    desktopOnly: false,
    requiresAuth: false,
  },

  init: async function () {
    HealthMonitor.init();
    console.log('[health-component] init: 监控已初始化');
    return HealthMonitor;
  },

  mount: async function (instance) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (instance && typeof instance.start === 'function') {
          instance.start();
          console.log('[health-component] mount: 自动轮询已启动');
        }
        resolve(instance);
      }, 1000);
    });
  },

  unmount: async function (instance) {
    if (instance && typeof instance.destroy === 'function') {
      instance.destroy();
      console.log('[health-component] unmount: 监控已停止');
    }
    return instance;
  },
};

export default healthComponent;
