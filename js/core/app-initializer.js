import { EventBus } from './event-bus.js';
import { EVENTS } from './event-constants.js';

export const AppInitializer = {
  _modules: [],
  _initialized: false,

  register: function (name, initFn, dependencies) {
    this._modules.push({
      name: name,
      init: initFn,
      dependencies: dependencies || [],
      loaded: false,
    });
    return this;
  },

  start: function () {
    if (this._initialized) {
      console.warn('[AppInitializer] 已经启动，跳过');
      return;
    }

    console.log('[AppInitializer] 开始启动应用...');
    const sorted = this._topologicalSort();
    sorted.forEach(function (module) {
      try {
        console.log('[AppInitializer] 初始化模块:', module.name);
        module.init();
        module.loaded = true;
      } catch (e) {
        console.error('[AppInitializer] 模块初始化失败:', module.name, e);
      }
    });
    this._initialized = true;
    console.log('[AppInitializer] 应用启动完成');
    EventBus.emit(EVENTS.APP_STARTED);
  },

  _topologicalSort: function () {
    const visited = {};
    const result = [];
    const self = this;

    function visit(name) {
      if (visited[name] === 'visiting') {
        throw new Error('循环依赖检测到: ' + name);
      }
      if (visited[name] === 'visited') return;
      visited[name] = 'visiting';

      const module = self._modules.find(function (m) {
        return m.name === name;
      });
      if (module) {
        module.dependencies.forEach(function (dep) {
          visit(dep);
        });
        result.push(module);
      }
      visited[name] = 'visited';
    }

    this._modules.forEach(function (module) {
      visit(module.name);
    });
    return result;
  },

  getStatus: function () {
    const status = {};
    this._modules.forEach(function (m) {
      status[m.name] = m.loaded ? '✅' : '⏳';
    });
    return status;
  },
};

