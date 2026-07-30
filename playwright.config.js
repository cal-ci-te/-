// Playwright 端到端测试配置
// 仅使用 Chromium（轻量化），支持本地开发和 CI 两种运行模式
// 项目：REVACHOL v1.12.2
//
// 测试项目依赖链：setup（登录→保存 storageState）→ chromium（继承登录态）
// auth.setup.js 通过 /api/auth/login 获取 Token 存入 .auth/user.json
// articles/decos/directory/settings 测试通过 storageState 复用此登录态

import { defineConfig, devices } from '@playwright/test';

// 通过环境变量切换模式：CI=true 时使用无头模式 + 更多重试
const isCI = process.env.CI === 'true';

export default defineConfig({
  // 测试文件目录
  testDir: './e2e-tests',

  // 全局测试超时（30 秒）
  timeout: 30 * 1000,

  // 每个测试的 expect 超时
  expect: {
    timeout: 10 * 1000,
  },

  // 失败重试：CI 环境重试 2 次，本地不重试
  retries: isCI ? 2 : 0,

  // 并行 worker 数：全部使用 1 个（避免 sql.js 并发写冲突）
  workers: 1,

  // 报告格式：HTML（playwright-archive 要求使用默认目录名，不要覆盖 outputDir）
  reporter: [['html', { open: 'never' }]],

  // 全局测试配置
  use: {
    // 基础 URL：Vite dev server 默认端口
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // 截图：仅失败时截取
    screenshot: 'only-on-failure',

    // 录像：CI 环境保留录像用于归档回放
    video: isCI ? 'retain-on-failure' : 'off',

    // 追踪：失败时记录
    trace: 'retain-on-failure',
  },

  // 项目配置：setup → chromium 依赖链
  projects: [
    // Setup 项目：登录并保存 storageState（仅运行一次）
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    // Chromium 项目：继承 setup 的登录态，运行所有其他测试
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CI 环境无头，本地可以有头调试
        headless: isCI ? true : false,
        // 继承 setup 项目保存的登录态
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // 开发服务器：始终配置，reuseExistingServer 保证不重复启动
  // 本地：自动启动 Vite dev server
  // CI / Docker：如果服务已运行（BASE_URL 可达），则复用
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60 * 1000,
    // 如果 CI 中前端容器已运行此端口，reuseExistingServer 直接通过
    // 如果端口不可达，则启动 npm run dev 作为后备
    stderr: 'pipe',
  },
});
