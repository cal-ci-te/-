# REVACHOL 端到端测试

基于 Playwright + playwright-archive 的端到端（E2E）测试套件。

## 测试文件结构

```
e2e-tests/
├── auth.setup.js          # Setup 项目：登录获取 Token → 保存 storageState
├── example.spec.js        # 冒烟测试：首页可访问性 + 核心元素存在（无需登录）
├── auth.spec.js           # 认证测试：登录/登出/错误密码（UI 交互）
├── articles.spec.js       # 文章 CRUD：创建/编辑/删除/切换可见性（需登录）
├── decos.spec.js          # 贴纸管理：上传/更新位置/删除（需登录）
├── theme.spec.js          # 主题切换：暗色/亮色/低保真（无需登录）
├── directory.spec.js      # 目录树：展开/折叠/搜索（需登录）
├── settings.spec.js       # 站点设置：读取/修改/权限验证（需登录）
└── .auth/                 # [.gitignore] setup 项目生成的登录态文件
    └── user.json
```

**执行顺序**：Playwright 先运行 `setup` 项目（`auth.setup.js`），登录后保存 `storageState` 到 `.auth/user.json`，然后 `chromium` 项目中所有需要登录的测试通过 `storageState` 自动注入 Token，无需逐个登录。

## 快速开始

```bash
# 首次使用：安装浏览器（仅需一次）
npx playwright install chromium

# 启动后端（终端 1）
cd backend && node server.cjs

# 运行全部测试（终端 2）
npm run test:e2e
```

## 测试命令

| 命令 | 说明 | 失败时行为 |
|---|---|---|
| `npm run test:e2e` | 运行全部测试 | ❌ 返回非 0 退出码 |
| `npm run test:e2e:ui` | UI 模式运行（可视化调试） | 不退出，手动控制 |
| `npm run test:e2e:setup` | 仅运行 setup（更新登录态） | ❌ 返回非 0 |
| `npm run test:e2e:archive` | 归档已有报告 → 启动仪表盘 | 无测试运行 |
| `npm run test:e2e:ci` | CI 模式：运行测试 → 通过则归档 | ❌ 失败时不归档 |
| `npm run test:e2e:serve` | 单独启动历史仪表盘 | — |

### 典型工作流

```bash
# 本地开发：运行测试 → 归档 → 查看历史
npm run test:e2e              # 先运行测试确认通过
npm run test:e2e:archive      # 归档报告并打开仪表盘（http://localhost:3200）

# CI 环境：全自动化
npm run test:e2e:ci           # 测试通过才归档，失败直接退出

# 调试：可视化单步执行
npm run test:e2e:ui
```

## 历史报告

[playwright-archive](https://www.npmjs.com/package/playwright-archive) 提供：

- 报告归档到 `run-history/`（按时间戳命名，永久保留）
- Web 仪表盘（`http://localhost:3200`）浏览所有历史运行
- 磁盘空间监控、Web 终端（v2.0+）

```bash
# 归档最近一次运行结果
npm run test:e2e:archive

# 单独查看历史（不运行新测试）
npm run test:e2e:serve
```

## 登录态机制

`auth.setup.js` 通过 Playwright 的 `request` API 直接调用 `/api/auth/login` 获取 Token，写入 localStorage 后保存 `storageState`。其他测试通过以下方式继承：

```js
// 在测试文件顶部添加
test.use({ storageState: '.auth/user.json' });
```

**优势**：
- 所有需登录的测试共享一次登录，速度提升 >50%
- Token 过期后只需重新运行 `test:e2e:setup`
- 冒烟测试（example.spec.js）不使用 storageState，验证未登录行为

## 编写测试用例

### 文件命名规范

- 使用 `*.spec.js` 后缀，放在 `e2e-tests/` 目录
- 按功能域命名：`articles.spec.js`、`theme.spec.js`
- `auth.setup.js` 是特殊文件（setup 项目），不使用 `.spec` 后缀

### 需要登录的测试模板

```js
import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/user.json' });

const createdIds = [];

test.afterAll(async ({ request }) => {
  for (const id of createdIds) {
    await request.delete(`/api/articles/${id}`);
  }
});

test('创建文章', async ({ request }) => {
  const resp = await request.post('/api/articles', {
    data: { title: '...', content: '...', category: '未分类' },
  });
  expect(resp.ok()).toBeTruthy();
  const { id } = await resp.json();
  createdIds.push(id);
});
```

### 注意事项

- 测试数据使用 `Date.now()` 后缀避免命名冲突
- `afterAll` 中清理创建的数据，即使测试失败也会执行
- 优先使用 `request` API（比 UI 交互更快、更稳定）
- playwright-archive 依赖默认 `playwright-report/` 和 `test-results/` 目录名，请勿覆盖

## CI 集成

```bash
# CI 环境变量自动启用无头模式 + 失败重试
CI=true npm run test:e2e:ci
```

| 环境变量 | 作用 |
|---|---|
| `CI=true` | 无头模式、失败重试 2 次 |
| `BASE_URL` | 自定义前端地址（默认 `http://localhost:3000`） |

webServer 配置始终启用 `reuseExistingServer: true`：
- 本地：自动启动 Vite dev server
- Docker：检测到端口已占用则复用，无需额外配置
