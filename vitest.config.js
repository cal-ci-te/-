// vitest.config.js
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default defineConfig({
  ...viteConfig,
  test: {
    // 测试环境：jsdom 模拟浏览器 DOM
    environment: "jsdom",
    // 测试文件位置
    include: ["tests/**/*.{test,spec}.js"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // 覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["js/**/*.js"],
      exclude: [
        "js/**/*.{test,spec}.js",
        "tests/**",
        "**/node_modules/**",
        "**/dist/**",
      ],
    },
    // 全局变量（让 describe, it, expect 无需导入）
    globals: true,
    // 每个测试前执行
    setupFiles: [],
  },
});