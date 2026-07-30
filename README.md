# REVACHOL

原创角色档案馆，一个带内容管理、贴纸装饰、水印保护、多主题切换的 Web 应用。

当前版本：v1.16.0

---

<!-- ===== 预览 ===== -->
<h2>预览</h2>

<h3>主题</h3>
<table>
  <tr>
    <th align="center">主题</th>
    <th align="center">截图</th>
  </tr>
  <tr>
    <td align="center">暗色</td>
    <td align="center"><img src="images/screenshots/dark.png" width="400" style="max-width:100%; height:auto;" alt="暗色主题"></td>
  </tr>
  <tr>
    <td align="center">亮色</td>
    <td align="center"><img src="images/screenshots/light.png" width="400" style="max-width:100%; height:auto;" alt="亮色主题"></td>
  </tr>
  <tr>
    <td align="center">低保真</td>
    <td align="center"><img src="images/screenshots/lofi.png" width="400" style="max-width:100%; height:auto;" alt="低保真主题"></td>
  </tr>
</table>

<h3>功能</h3>
<table>
  <tr>
    <th align="center">功能</th>
    <th align="center">截图</th>
  </tr>
  <tr>
    <td align="center">目录树</td>
    <td align="center"><img src="images/screenshots/tree.png" width="400" style="max-width:100%; height:auto;" alt="目录树"></td>
  </tr>
  <tr>
    <td align="center">贴纸系统</td>
    <td align="center"><img src="images/screenshots/deco.png" width="400" style="max-width:100%; height:auto;" alt="贴纸系统"></td>
  </tr>
  <tr>
    <td align="center">移动端</td>
    <td align="center"><img src="images/screenshots/mobile.png" width="400" style="max-width:100%; height:auto;" alt="移动端"></td>
  </tr>
</table>

---

## 功能

- 文章：增删改查、分类管理、可见性控制、无限滚动
- 目录树：折叠展开、拖拽排序、右键菜单
- 详情页：标签页模式、全屏、最小化
- 贴纸：上传（自动压缩为 WebP）、管理、移动和缩放（统一编辑模式）
- 主题：暗色、亮色、低保真三套
- 管理面板：登录、头像、背景、纹理、水印、色卡
- 移动端：响应式布局、触摸拖拽、长按菜单

---

## 技术栈

前端：原生 ES Module、Vite、自研状态管理（AppState + EventBus）
后端：Node.js 22 + 原生 http、sql.js（SQLite）、WebSocket
部署：Docker Compose（镜像加速、非 root 运行、端口安全绑定）
存储：本地文件系统 / S3 兼容对象存储（适配器模式切换）
监控：ErrPulse
测试：Vitest + jsdom（单元）、Playwright（端到端）、playwright-archive（历史报告）

---

## 项目结构

```bash
revachol/
├── js/                        # 前端
│ ├── core/                    # 状态、事件、引用
│ ├── services/                # 业务逻辑
│ ├── ui/components/           # UI 组件
│ ├── admin/                   # 管理模块
│ └── utils/                   # 工具函数
├── css/                       # 样式（主题、响应式）
├── backend/                   # 后端
│ ├── routes/                  # 路由
│ ├── storage/                 # 存储适配器
│ └── uploads/decos/           # 贴纸文件
└── tests/                     # 单元测试
```

---

## 快速开始

### 本地开发

环境：Node.js 20+（Vite 7 最低要求；Docker 使用 22，本地已验证 24）

```bash
# 前端
npm install
npm run dev

# 后端
npm install
node backend/server.cjs
```

### Docker 部署

```bash
docker compose up -d --build
```

详见 [`docs/deployment/docker-setup.md`](docs/deployment/docker-setup.md)

管理员账号：admin / admin123（生产环境通过 `ADMIN_PASSWORD` 环境变量覆盖）

### 存储配置

创建 backend/.env 文件：

STORAGE_TYPE=local

#### 或使用 S3 兼容存储
STORAGE_TYPE=rustfs
RUSTFS_ENDPOINT=http://localhost:9000
RUSTFS_ACCESS_KEY=minioadmin
RUSTFS_SECRET_KEY=minioadmin
RUSTFS_BUCKET=revachol

## 架构亮点

存储层适配器模式：本地文件系统与 S3 兼容存储无缝切换，业务代码零感知。

Docker 安全部署：进程降权（非 root）、端口默认仅绑定 localhost、环境变量驱动的灵活配置。

目录树模块化：从 400+ 行拆分为 12 个职责单一的模块。

单向数据流：ArticleService 为唯一数据源，ArticleListStore 派生数据无副本。

多主题系统：CSS 变量驱动，三套主题动态加载。

## 更新日志

### v1.16.0

**超现实箱子交互组件**：

在页面右下角新增一个可交互的 3D 旧木箱悬浮装饰，增强项目的沉浸感与超现实主义氛围。

- **开箱动画**：点击箱子 → 五阶段动画序列（开箱 0.4s → 物品弹出 0.6s → 展示 1.5s → 物品收回 0.4s → 关箱 0.4s），物品 Emoji + 名称 + 描述随机弹出，连续两次不重复
- **物品池**：8 件超现实物品（白色羽毛 / 旧硬币 / 生锈钥匙 / 字条 / 沙粒 / 纽扣 / 小镜子 / 空无），各有独特文案
- **计数持久化**：每次开箱计数 +1，底部显示"已打开 x 次"，刷新不丢失（localStorage `rv_box_data`）
- **拖拽双模式**：普通用户拖拽后以弹簧动画飞回默认位置；管理员（`AppState.isLoggedIn`）拖拽直接设定新默认位置并持久化
- **3D 木箱外观**：`perspective` + `rotateX` 实现箱盖旋转打开，黄铜合页 / 锁扣 / 木纹纹理 CSS 装饰，三套主题 `var(--color-*)` 自动适配
- **自定义图片接口**：预留 `customImage` 字段 + `setCustomImage()` API，后续可通过管理面板上传自定义箱子外观
- **模块化设计**：参照 Puzzle 组件模式拆分为 `BoxItemPool` / `BoxState` / `BoxDrag` / `BoxRenderer` / `BoxManager` 五层，6 文件 847 行 JS + 313 行 CSS，零外部依赖

### v1.15.0

**贴纸统一编辑模式 — 移动 + 缩放合并**：

将原来分离的「编辑位置」和「调整大小」两个独立编辑入口合并为一个统一的「📐 移动和缩放」模式。

- **统一入口**：右键菜单从 3 个分散项（编辑位置 / 调整大小 / 恢复默认大小）收敛为 1 个「📐 移动和缩放」；管理面板贴纸库 📍 按钮同步改为 📐
- **统一操作**：一次进入即可同时拖拽移动 + 拖拽右下角控制点缩放，无需在两种模式间切换
- **三按钮工具栏**：确认更改（保存位置+大小） / 重置（恢复到快照，保持模式） / 取消（恢复到快照，退出模式）；新增 ESC 键等同取消
- **未放置贴纸支持**：从贴纸库点击 📐 时自动渲染到屏幕正中（100×100 默认尺寸），确认后更新为已放置；取消则移除元素恢复未放置状态
- **模块重构**：新建 `js/services/deco-edit.js`（~630 行）替代旧 `deco-resize.js`（已删除）；`DecoEdit` 对象字面量，18 个方法，零依赖注入
- **样式更新**：`css/components/deco-resize.css` 新增 `.deco-editing`、`.deco-edit-handle`、`.deco-edit-toolbar` 三套类名，移动端响应式适配
- **安全清理**：`admin/auth.js` 登出时同步退出 `DecoEdit` 编辑状态

### v1.14.0

**贴纸大小可变（缩放）功能**：

- **核心交互**：右键贴纸 →「📐 调整大小」→ 右下角出现圆形控制点 → 拖拽改变尺寸 → 底部工具栏「✅ 确认」保存或「❌ 取消」回退
- **性能优化**：`requestAnimationFrame` 节流（≤60fps）+ CSS `transform` 方案预留（`useTransform: true` 切换 GPU 加速模式，不触发 Reflow）
- **边界约束**：最小 40px，最大不超过视口；右下角控制点不超出屏幕；尺寸变化后自动钳制位置确保贴纸不越界
- **默认大小**：首次进入缩放模式时记录当前尺寸为默认值，「↺ 恢复默认」恢复到该值而非原始图片尺寸（避免手柄因原图过大而超出屏幕）
- **多贴纸防冲突**：贴纸 A 缩放中点贴纸 B → A 自动退出（不保存），B 进入缩放模式
- **删除自动退出**：缩放模式下贴纸被删除时自动退出缩放模式
- **事件清理**：退出缩放时完整解绑控制点 `mousedown`/`touchstart` 和 `document` 级 `mousemove`/`mouseup`，移除控制点 DOM
- **渲染扩展**：`DecoShelf._applyDecoSize()` 支持 `position.width`/`height`（默认方案 B）和 `position.scaleX`/`scaleY`（方案 C transform），已有贴纸兼容
- **右键菜单修复**：修复贴纸首次从库中放置后右键无响应的问题（`_renderSingleDeco` 现有元素分支确保 `pointer-events: auto` + contextmenu 事件绑定）

### v1.13.1

**文章编辑器认证令牌修复**：

- **根因**：编辑器页面（`article-editor.html`）是独立 HTML 文档，拥有独立的 JS 上下文。`ApiClient` 的请求拦截器仅在主页面 `app.js` 中注册，导致编辑器内所有需认证的 API 调用（草稿保存/恢复/删除、文章保存）均不携带 `Authorization` 头，返回 401
- **修复 `ApiClient` 拦截器缺失**：在 `article-editor.js` 中注册与主页面相同的请求拦截器（注入 `Bearer Token`）+ 响应拦截器（401 自动清理过期 Token + 更新登录状态）
- **修复 `autoSaveOnUnload` 令牌缺失**：页面关闭/隐藏时的草稿自动保存从 `sendBeacon`（不支持自定义请求头）改为 `fetch + keepalive: true`，并注入 `Authorization` 头

### v1.13.0

**E2E 测试体系 + 单元测试补全 + Docker 测试容器化**：

- **Playwright 端到端测试**：
  - 新增 `playwright.config.js`，仅使用 Chromium，支持 local/CI 双模式
  - 测试套件覆盖 7 个功能域：冒烟（首页可访问性）、认证（登录/登出/Token 验证）、文章 CRUD（创建/编辑/删除/可见性）、贴纸管理（上传/更新/删除）、主题切换（暗色/亮色/低保真）、目录树（折叠/展开/搜索）、站点设置（读取/修改/权限验证）
  - 登录态复用机制：`auth.setup.js` 通过 API 获取 Token → `storageState` 保存 → 其他测试项目通过 `dependencies: ['setup']` 继承，避免重复登录
  - 集成 playwright-archive：测试报告自动归档到 `run-history/`，支持历史仪表盘（`http://localhost:3200`）
  - webServer 优化：从 `isCI ? undefined` 改为始终配置 `reuseExistingServer`，本地/Docker/CI 三环境零配置切换
  - 归档脚本重构：`test:e2e`（纯测试） | `test:e2e:archive`（仅归档） | `test:e2e:ci`（测试→通过才归档），消灭 `|| exit 0` 吞噬失败信号问题
- **单元测试补全**（5 个模块，97 个用例）：
  - `tests/unit/auth.test.js`：generateToken / verifyToken / revokeToken / requireAuth / requireRole / optionalAuth / compose，含完整 req/res mock 与集成测试
  - `tests/unit/app-state.test.js`：commit() API 全覆盖（19 种 mutation + SET_KEY + 订阅者通知 + reset + snapshot）
  - `tests/unit/api-client.test.js`：GET/POST/PUT/DELETE + FormData + 拦截器链 + 超时 408
  - `tests/unit/function.test.js`：debounce / throttle（fake timers + this 绑定 + 参数验证）
  - `tests/unit/event-bus.test.js`：补充 emit 无数据/once+on 混用/off 不存在回调/错误恢复 等边界
- **Docker 测试容器**：
  - 新增 `Dockerfile.test`：基于 `mcr.microsoft.com/playwright:v1.48.0-noble` 官方镜像（预装 Chromium + 系统依赖），三层 COPY 缓存优化，`pwuser` 非 root 运行
  - `docker-compose.yml` 新增 `playwright-tests` 服务：依赖 backend + frontend，bind mount 持久化报告，一次性运行自动退出
  - `e2e-tests/playwright.docker.config.js`：Docker 专用配置（60s 超时、始终无头、录像开启、webServer: undefined）
  - `scripts/run-e2e-in-docker.sh`：一键脚本（检查 Docker → 启动依赖 → 等待就绪 → 运行测试 → 归档报告）
  - npm 脚本：`test:e2e:docker` | `test:e2e:docker:build` | `test:e2e:docker:ci`
- **文档**：
  - `e2e-tests/README.md`：测试文件结构、命令速查、登录态机制说明、编写指南、CI 集成
  - `e2e-tests/DOCKER-README.md`：Docker 测试架构、调试指南、常见问题

### v1.12.2

**拼图核心渲染重构 — 块背景像素直读 + 坐标系统一 + 缺口边界修复**：

拼图块背景重构为 `ctx.getImageData` 直接从主 Canvas 读取缺口区域像素（替代之前三版方案：CSS `backgroundPosition` 符号/竞态、离屏 Canvas 坐标变换），**零计算偏差**。缺口/块的 CSS 位置改为与滑块相同的 `getBoundingClientRect` + `canvasScale` 方案，消除 Canvas 缩放或偏移时的坐标不一致。缺口边界计算改为 tabR 感知，防止小画布/大块时缺口溢出。

- **块背景重建**：`_render()` 块层从「计算 imageSource → 离屏裁剪」改为 `ctx.getImageData(gx-tabR, gy-tabR)` 直读主 Canvas 已绘制的像素，`putImageData` 写入离屏 Canvas 后 `toDataURL` 作为 `backgroundImage`，`background-size: 100% 100%` 无对齐计算
- **坐标系统一**：新增 `canvasOffLeft/Top`（`getBoundingClientRect` 差异）+ `canvasScale`（`clientWidth / canvas.width`），缺口/块的位置和尺寸统一乘以 `canvasScale`，与 `positionSlider` 完全一致
- **缺口边界修复**：`_resetGapX` 动态计算 `tabR` 作为最小边距，`maxGap = canvasW - gapW - tabR`（替代硬编码 `100`/`200`）；新增 `_clampGapY` 确保缺口垂直不溢出
- **_onRedraw 时序修复**：`_onRedraw` 移至 `importState` 之前设置，避免异步图片加载后重绘回调为 null
- **_cachedImg onload 加固**：复用缓存 Image 对象时刷新 `onload` 绑定，确保 `_onRedraw` 始终被调用
- **overhang 默认值**：`200` → `100`，滑块有效行程占比从 26% 提升至 34%，精度从 7.3px/单位降至 5.5px/单位

### v1.12.1

**拼图形状修复 + 贴纸持久化（修复 v1.10 Token 认证迁移引发的数据丢失）**：

- **根因**：v1.10 将管理员认证从硬编码密码改为 Token 机制后，`auth_token` 存储在 `localStorage` 中。硬刷新（Ctrl+Shift+R）清空 `localStorage` → `requireAuth` 拦截 `PUT /api/decos/:id` → 贴纸位置数据永不到达服务器 → 再次硬刷新永久丢失
- **贴纸持久化修复**：
  - `DecoRepository.load()` 修复空数组 `[]`（truthy）误判为有效缓存，导致跳过服务器请求（`_cache.length > 0`）
  - `_syncFromServerSilently()` 实际执行服务器数据合并：服务器有有效位置时采用，本地有位置但服务器为 null 时加入重试队列
  - 新增 `_retryFailedSyncs()`：每次 `load()` 重试之前失败的 PUT
  - `save()` 失败时将贴纸 ID 写入 `deco_sync_fail_queue`
  - 贴纸两种状态均可持久化：未放置（`position: null`）和已放置
  - `_renderSingleDeco` 增加 `document.body` 守卫，`module-registry.js` 渲染时序修复
- **拼图模块修复**：
  - 统一 `blockSize` 为块大小和缺口的唯一数据源，删除独立 `gapSize`
  - `PuzzleRenderer` 下边/左边凸起 arc 方向 CCW→CW，修复向内凹陷 bug
  - `_render()` 使用独立 `scaleX`/`scaleY` 修复 Y 轴偏移（Canvas CSS 与内部分辨率不同比）
  - `_render()` 动态更新 DOM 块 `width`/`height`/`clipPath` 并统一乘 scale
  - `PuzzleDrag.setBlockW`/`setOverhang` 自动重算 `_minThumbX`
  - `setSize()` 同步更新 Canvas CSS 尺寸和轨道宽度
  - `init()`/`load()`/`importState()` 全路径同步 blockSize 到渲染器和拖拽模块
- **CSS**：`.puzzle-block` 移除硬编码 `width:72px;height:72px;border-radius:8px;border:1px`，改为 `box-sizing:border-box;border:none;border-radius:0`，由 JS 全权控制

### v1.12.0

**主题系统简化 + 拼图渲染修复 + 移动端禁用**：

- **主题系统重构**：消除 @import 链，3 个主题各 5 子文件合并为单文件加载；切换从动态 <link> 创建/销毁改为三套预加载 + disabled toggle，零网络请求即时切换
- **拼图分割线修复**：重写为双路径方案（外路径亮色描边 + 内路径暗色描边各偏移 1px），确保暗/亮/图片背景下均清晰可见
- **移除边缘磨损粒子**：效果参数过细微不可见 + 仅在纯色模式生效，删除相关 118 行代码
- **拼图块 Y 轴对齐**：gapY 改为直接读取 renderer.gapY，消除与 Canvas 缺口位置的偏差
- **移动端禁用拼图**：init() 首行检测 ≤600px 提前返回；移除所有移动端 CSS 媒体查询规则和 JS 移动端方法

### v1.11.0

**滑动拼图装饰性交互组件**：

- **拼图机制**：Canvas 绘制背景图片（或主题纯色）→ 随机位置挖缺口 → DOM 拼图块跟随滑块移动 → 对齐 ±5px 触发闪光动画
- **图片源优先级**：用户自定义图片（管理面板上传，复用头像裁剪 UI 锁定 8:3 宽高比）→ 主题纯色背景 → 默认几何图形
- **自定义 DOM 滑块**：纯 div 实现 track + thumb（72×72 圆角矩形），绕过浏览器原生 `<input type=range>` 的 thumb 裁切限制，thumb 和拼图块共用 blockX 坐标
- **溢出支持**：拼图块和滑块均可 overflow visible，溢出距离通过 `setOverhang()` 控制
- **跟随鼠标**：`_setBlockX` 将 track 上的鼠标位置直接映射为 blockX，thumb 1:1 跟随，不受 overhang 影响
- **移动端适配**：≤600px 强制流式模式（hero-section 下方），禁用溢出；Canvas 百分比缩放 + DOM 位置同步乘 scale；滑块缩小为 36×36
- **拖动文字保护**：拖动期间 `userSelect: none`，释放后恢复
- **管理面板集成**：上传/恢复默认按钮，`UI.puzzle.*` 文案统一管理

### v1.10.0

**后端 Token 认证体系**：

- **Token 管理**：新增 `backend/auth.js`（232 行），基于内存 Map 的 Token 生成/验证/撤销
  - Token 生成使用 `crypto.randomBytes(32).toString('hex')`（密码学安全）
  - `requireAuth` handler 包装器：不修改 enhance.cjs，以最小侵入保护路由
  - `optionalAuth`：有 Token 注入用户信息，无 Token 不阻塞（适配"登录看更多"场景）
  - `compose` 中间件组合工具 + `requireRole` 角色校验，为未来多角色扩展预留接口
  - `tokenStore` 抽象层封装 Map，标注 Redis 迁移路径
- **路由保护**：全部写操作端点（articles/decos/drafts/settings）包裹 `requireAuth`
  - 读操作（GET）保持公开，访客可正常浏览
  - CORS 头增加 `Authorization` 支持
- **登录/登出 API**：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
  - 密码从 `ADMIN_PASSWORD` 环境变量读取（开发环境回退 `admin123`）
  - 登录响应返回 `{token, userId, role, expiresIn}`
- **前端认证闭环**：
  - `AdminAuth.login/logout` 改为 async 调用后端 API，Token 存入 `localStorage`
  - `ApiClient` 请求拦截器自动注入 `Authorization: Bearer <token>` 头
  - 401 响应 → `EVENTS.AUTH_UNAUTHORIZED` → 自动清理 Token + 退回访客模式
  - 页面刷新从 `localStorage` 恢复登录状态
  - `article-editor.js` 改为从 Token 判断登录状态（不再硬编码）
- **工程预留**：
  - `db.cjs` 新增 `users` 表 + `articles.author_id` 列迁移
  - `backend/scripts/seed-admin.js` 管理员种子脚本（bcrypt 哈希 + 幂等）
  - 5 条 `[FUTURE]`/`[DEPLOY]` 注释：Redis 迁移、bcrypt 升级、刷新 Token、暴力破解防护、服务器重启行为

### v1.9.2

**Service 层通用化**：

- 新增 `CustomIconManager`（js/services/custom-icon.js）：通用自定义图标管理器，支持任意 UI 元素的"自定义图标 + 回退"能力，每实例独立 `storageKey` + DOM 选择器，零实例冲突
- 站点图标重构：app.js 内联 IIFE（22 行）提取为 `js/services/site-icon.js` SiteIcon 实例，保持向后兼容

**色值统一为 CSS 变量（Phase 1-3）**：

- Phase 1：10 个 CSS 组件文件 ~90 处硬编码色值 → `var(--color-*)`
- Phase 2：8 个编辑器/页面 CSS 文件 ~55 处硬编码色值 → `var(--color-*)`
- Phase 3：22 个 JS 文件 ~80 处内联样式色值 → `var(--color-*)`
- 全项目非 themes/ CSS 中 12 种核心暗色硬编码清零（仅保留 `<input type="color">` 和 JS 运行时默认值）

**站点图标样式升级**：

- 针脚装饰：单 `::before` 线段 → 双 `::before` + `::after` 圆形钉（accent 色）
- 图标容器：+`border-radius`、+`box-shadow`、+`flex` 居中、+`transform-origin`
- Emoji 回退字号：40px → 60px，+`line-height: 100px`
- img/span：+`transform-origin`、+`transition: transform 0.2s`

**Bug 修复**：

- 修复最小化标签页关闭后刷新再现：`closeTab` 增加 `tabElement`/`paneElement` null 守卫（最小化条目无 DOM 元素，`.remove()` 抛 TypeError 阻断 `_saveMinimizedState`）
- 修复 `closeAll` 同款 null 守卫缺失

**文档**：

- 新增 `docs/development/custom-icon-guide.md`：自定义图标组件使用指南（实例创建 / CSS / 管理面板集成）

### v1.9.1

**移动端样式优化**：

- 卡片严格左右交错排列：卡片交错从 `nth-child`（按父级计数）改为 `.card-left`/`.card-right` 类选择器（由 JS 全局 `cardIndex` 赋值），跨越文件夹边界连续交替
- 侧边栏位置下移：`sidebar.js` 移动端默认 `top` 从 80px → 68px，`loadState`/`loadPosition` 双入口强制移动端覆盖已保存值
- 登录入口增大：头像 28→36px，标签 8→10px，欢迎语 7→9px
- 位置控件主题适配：三套主题 `_sidebar.css` 中写入 `var(--color-*)` 变量覆盖，替代 `admin.css` 硬编码暗色值
- 心跳加载动画主题平滑：`index.html`/`article-editor.html` 内联预加载脚本（处理 StorageAdapter `rv_` 前缀 + JSON 编码），`data-theme` 在第一帧渲染前就位
- 贴图库入口隐藏：`#assetUploadBtn`/`#assetFileInput`/`#assetListContainer` 移动端隐藏，仅显示移动端不支持贴纸

**修复**：

- 修复 `small-mobile.css`（≤480px）后加载覆盖 `mobile.css`（≤768px）导致移动端样式未生效
- 修复 `sidebar.js` `loadPosition()` 在 `loadState()` 之后运行，用旧保存值覆盖移动端默认值
- 修复内联预加载脚本读 `selected_theme` 裸键而非 StorageAdapter 前缀键 `rv_selected_theme`
- 修复位置控件色值经 Vite HMR `@import` 链注入被绕过，改为主题 CSS `<link>` 直载

### v1.9.0

**全局命名空间收敛与架构解耦**：

- **全局收敛**：14 个 `window.X` 合并为 `window.__REVACHOL__` 单一命名空间，10 个消费方同步更新；附带修复 `window.UI`、`window._UIDetail`、`window._UISidebar` 三个从未赋值的死引用
- **事件常量补全**：`event-constants.js` 从 20 → 40 个常量，覆盖 admin/deco/auth/theme/position 五个事件域；`admin/index.js` 等 6 个文件全部替换散落字符串为 `EVENTS.*`
- **Service 层封装**：ArticleService 新增 6 个公开方法（`getCategoryChildren`、`findCategoryById`、`reparentCategoryChildren`、`removeCategoryEntry`、`removeCategoriesByIds`、`saveSnapshot/restoreSnapshot`），消除 `context-menu.js`（10 处）、`drag-drop.js`、`touch-drag.js`、`position-manager.js`（6 处）等外部文件对 `_categories`/`_data`/`cache` 私有字段的直接访问
- **Store 透传**：ArticleListStore 新增 5 个代理方法，detail.js、events.js、directory-visibility.js、index.js 四个 UI 组件从直引 ArticleService 改为通过 Store 获取数据

**Bug 修复**：

- 修复贴纸在 `absolute` 定位下拖拽发生坐标偏移（编辑期间临时转为 `fixed`，保存时还原坐标系）
- 修复目录树在位置管理模式中反复 enter/exit 后拖拽弹窗重复触发（`enableDragDrop` 旧监听器未清理导致叠加）

### v1.8.2

**开发文档与版本声明修正**：

- 新增 `docs/development/tools/` 开发工具文档（Vitest / ErrPulse / Docker Compose，含索引）
- Node.js 最低版本声明从 "18+" 更正为 "20+"（Vite 7 实际要求 >=20.19.0）
- 文档中注明实际运行版本：Docker 使用 22 LTS，本地开发机已验证 24
- 此版本差异无功能性冲突——两个版本均为受支持发行版，依赖兼容性审查已覆盖

### v1.8.1

**贴纸动画修复**：

- `_renderSingleDeco` 改为"原地更新"策略：元素已存在时直接修改 CSS 属性（position/top/left/width/height），不再 remove + createElement 重建
- `_renderAllDecos` 同理：遍历贴纸调用 `_renderSingleDeco` 原地更新，末尾清理孤儿元素（已在库中删除或无位置的贴纸 DOM）
- `setStyle`（v1.8.0 已部分修复）继续使用直接 DOM 更新，不经过 render 方法

效果：贴纸仅在网页首次加载时播放 `fadeInUp` 入场动画，移动位置、切换样式（fixed ↔ absolute）均为即时 CSS 更新，无动画重播。

### v1.8.0

**Docker 化部署与安全加固**：

- **Docker 部署方案**：`docker compose up -d --build` 一键启动前后端双容器，SQLite + 贴纸通过命名卷持久化。含完整操作文档（`docs/deployment/docker-setup.md`）
- **Node.js 22 升级**：基础镜像 `node:18-alpine` → `node:22-alpine`，经全量依赖兼容性审查（`docs/node-22-upgrade-review.md`），确认 0 个原生模块风险
- **进程降权运行**：容器内以 `node` 用户（非 root）启动后端，限制潜在攻击面
- **端口安全绑定**：默认仅监听 `127.0.0.1`，云服务器通过 `BIND_ADDR=0.0.0.0` 一键切换
- **镜像加速**：配置轩辕镜像 `docker.xuanyuan.me` 解决 Docker Hub 拉取超时

**运行时适配**：

- 后端监听地址改为 `HOST` 环境变量控制
- Vite Proxy 三项目标统一由 `VITE_BACKEND_URL` 控制，本地开发行为不变
- `watch.usePolling` 增加 `interval: 2000` 降低 WSL2 跨文件系统 I/O

**Bug 修复**：

- 修复 `storage/config.cjs` 中 `uploadDir` 路径解析错误（`../../uploads/decos` → `../uploads/decos`），原被 root 权限掩盖
- 修复贴纸切换样式（fixed ↔ absolute）后位置丢失与入场动画重播：`setStyle()` 改为原地更新 DOM 属性，跳过 `_renderSingleDeco` 的 remove + createElement 触发 CSS `fadeInUp` 重播

### v1.7.0

**最小化标签页持久化**：刷新不丢失，localStorage 存取 + 全量重渲染保证顺序一致。去重处理（同一文章不重复开标签页）。激活详情页时自动隐藏 minimized bar。

**文章格式保留**：详情页 + 卡片 `white-space: pre-wrap`，首行缩进、空行、段落间距完整保留。

**站点图标**：标本悬挂样式（图标溢出方框 + 针脚装饰 + drop-shadow），优先加载自定义图标 → `images/site-icon.png` → 🎭 emoji 回退。一次性摇摆入场动画。

**页面渐入动画**：加载完成后文字（0.12s）→ UI 控件（0.25s）→ 贴纸（0.45s）三级延迟淡入。

**编辑器 favicon 同步**：文章编辑器页面现在也随主题切换标签页图标。

### v1.6.0

**心跳开屏加载动画**：SVG 双层心电图波形 + 脉冲光晕，CSS 变量适配三套主题。加载期间锁定页面滚动，至少显示 300ms，10s 超时兜底。

**主题 Favicon 同步**：切换主题时动态替换标签页图标。暗色/亮色/低保真各一套 `.ico` + `.png` 双版本。

**文章卡片交错排布**：`nth-child` 改为全局 `cardIndex` 递增，文件夹边界不再打断左右交替。

**低保真最小化标签页**：补 32 行 lofi 覆盖（CSS 变量 + 像素风），minimized-bar 不再硬编码暗色值。

### v1.5.1

**草稿管理补丁**：
- 修复 `cleanup-drafts.cjs` 语法错误（多余 `}` 导致模块加载失败，后端静默退出）
- 修复 `query()` 和 `exec()` 仍使用原始绑参 API 导致 COUNT 查询和 DELETE 失效（db.cjs 四个函数全部统一为 `escapeSql` + `db.exec`）
- 修复 `DELETE ... ORDER BY ... LIMIT` 在 sql.js 中不兼容 → 改为子查询

### v1.5.0

**草稿系统全面修复**：

sql.js 参数绑定 Bug 排查（历时最长修复）：
- 发现 `stmt.run(params)` 返回 `lastInsertRowid: 0`——sql.js CDN 版本绑参不执行 INSERT
- 切到 `db.exec(手动转义SQL)` 后 `lastInsertRowid` 递增但 `db.export()` 文件大小不变——INSERT 在内存生效但未被子系统追踪
- 定位到 `queryAll()` 从未调用 `stmt.bind(params)`——`WHERE article_id = ?` 始终为空结果集
- 最终方案：统一 `escapeSql()` 工具函数手动转义 + `BEGIN/COMMIT` 显式事务 + `db.exec()` 执行

**草稿管理策略**：
- 数量限制：每文章最多 20 条草稿，超出自动删除最旧
- 过期清理：30 天前草稿自动清理（启动全量 + 每次保存增量双保险）
- 保存节流：多写入合并为单次 `db.export()`（5s 间隔可配），消除并发冲突

### v1.4.0

**安全加固**：贴图上传后端增加 magic number 校验（PNG/JPEG/WebP），防止非图片文件绕过前端上传；文章/贴图标题、内容、分类增加业务层长度校验。

**贴图系统升级**：
- 边界约束：拖拽 / 保存 / 窗口 resize 自动钳制，确保贴图不超出屏幕
- 位置编辑控件移至贴图下方（重置 / 确认 / 取消三按钮居中）
- 贴图库按钮改为紧凑两行布局
- 修复右键菜单 DOM 被误删导致二次失效

**文章编辑器主题同步**：编辑器与主页面主题实时同步（暗色 / 亮色 / 低保真），通过 BroadcastChannel 双端联动。

**修复**：
- 后端 `url.parse()` 弃用 → WHATWG `new URL()`
- 贴图样式切换 Toast 统一为"已切换"
- 主页面切换到亮色时编辑器延迟加载变量（`onload` 链式加载）
- 草稿历史面板 UI 文案 key 修正

### v1.3.0

**工程注释重构**：全项目 107 个文件删除装饰性分隔线与废话注释，新增 25+ 处工程决策注释，覆盖自研路由层 / 状态管理 / EventBus / ApiClient / 存储适配器等核心模块，标注技术债与已知限制。

**修复**：
- 贴纸存储恢复本地文件系统，修改 `.env` 一行可切换 RustFS
- 访客模式下文件夹折叠/展开修复（匿名监听器泄漏导致偶数抵消）
- 登出后头像实时切换为访客默认图片
- 登录后贴纸右键菜单恢复（DOM 移除改为隐藏）
- 访客模式下贴纸右键菜单禁用（权限守卫遗漏）
- `:scope > .children` 改为 `.children` 兼容更多浏览器

### v1.2.0

**工具栏**：左上角新增可展开工具栏，当前含使用说明组件。点击展开后在详情标签页中阅读网站说明，与文章阅读体验一致。

**卡片高亮**：点击目录树跳转到文章卡片时，显示主题自适应辉光动画（暗色暖金 / 亮色暖棕 / 低保真米褐），1.5 秒自动消退。

**详情页升级**：
- 铺满全屏，无边框间距与宽度限制
- 滚动隔离——阅读时不会触发外部页面滚动
- 顶部栏改为浏览器式标签行：标签页在左，最小化/全屏/关闭在右

**主题拆分**：三个主题文件拆分为 5 模块（变量 / 布局 / 内容 / 侧边栏 / 交互），按功能域定位。

**贴纸存储**：统一使用本地文件系统，`.env` 中 `STORAGE_TYPE=local`。

### v1.1.0

**实时通信**：主页面与文章编辑器页面之间通过 BroadcastChannel 实现可见性修改的实时同步，无需刷新。

**主题优化**：
- 暗色/亮色主题目录树字体补全（IM Fell English 古卷宗体）
- 低保真主题按钮全覆盖、标题居中、卡片重新设计为 6 种不规则裁剪 + SVG 撕纸边缘滤镜 + 透底纸张白纸配色
- 三个主题下登录入口尺寸统一增大，头像占比提升
- 目录树行距统一，消除访客/管理员模式切换时的布局跳动

**交互修复**：
- 贴纸右键菜单恢复（与目录树菜单 id 冲突已解决，两菜单完全独立并有三套主题样式）
- 访客↔管理员模式切换即时生效，目录树与文章列表自动刷新
- 文章编辑器页面加载稳定性提升（重复导入修复 + 安全超时 + 错误处理）

## 后续计划

文章全文搜索

多语言支持

文章全文搜索

多语言支持
