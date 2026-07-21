# REVACHOL 架构文档

> 版本：v1.9.0 | 更新：2026-07-21

---

## 1. 项目概述

REVACHOL 是一个**原创角色档案馆** Web 应用。用户可创建、分类、展示角色文章，上传贴纸装饰页面，在三套主题间切换。支持内容管理和访客浏览双模式。

**技术栈**：前端用原生 ES Module + Vite 打包，后端用 Node.js 原生 http 模块 + sql.js（SQLite WASM），存储层适配器模式切换本地/S3，Docker Compose 一键部署。

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    浏览器                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 主题 CSS │  │ 贴纸层   │  │ 详情标签页        │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────┤
│  前端 (ES Module, Vite :3000)                       │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ core/   │  │ services/│  │ ui/components/    │  │
│  │ AppState│  │ArticleSvc│  │ detail/directory/  │  │
│  │ EventBus│  │ DecoShelf│  │ articles/sidebar/  │  │
│  │ DOMRefs │  │ ThemeSvc │  │ deco-ui/           │  │
│  └─────────┘  └──────────┘  └───────────────────┘  │
│                      │                              │
│         ┌────────────┴────────────┐                 │
│         │  ApiClient (fetch)      │                 │
│         │  WebSocketManager       │                 │
│         │  BroadcastChannel       │                 │
│         └────────────┬────────────┘                 │
├──────────────────────┼──────────────────────────────┤
│  后端 (Node.js, :9999)        │                     │
│  ┌──────────┐  ┌──────┐  ┌────┴─────┐              │
│  │ enhance  │  │routes│  │ storage  │              │
│  │ (路由层) │  │ CRUD │  │ local/   │              │
│  │          │  │      │  │ rustfs   │              │
│  └──────────┘  └──┬───┘  └────┬─────┘              │
│                   │           │                     │
│              ┌────┴────┐  ┌──┴──────────┐          │
│              │ db.cjs  │  │ 文件系统/S3  │          │
│              │ (sql.js)│  └─────────────┘          │
│              └─────────┘                            │
│              │ WebSocket (ws)                       │
│              │ BroadcastChannel                     │
├─────────────────────────────────────────────────────┤
│  Docker Compose                                     │
│  frontend (Vite :3000) ←→ backend (Node :9999)     │
│  卷: revachol_data (.db)  revachol_uploads (贴纸)   │
└─────────────────────────────────────────────────────┘
```

**分层原则**：前端单向数据流（Service → Store → UI），后端路由→数据→存储三层分离。

---

## 3. 前端架构

### 3.1 状态管理

不使用 Redux/Vuex。自研两个轻量模块：

| 模块 | 大小 | 职责 |
|------|------|------|
| `AppState` | ~120 行 | 集中式 state + mutation 提交 + 键订阅通知 |
| `EventBus` | ~40 行 | 发布-订阅，跨模块松耦合通信 |

**设计理由**：项目约 15 个状态键，引入 Vuex/Pinia（~30KB）的收益不抵开销。自研实现 <1KB，接口与 Vuex 一致（`commit(mutation, payload)` + `subscribe(key, callback)`）。

```js
// 典型数据流
用户操作 → EventBus.emit('visibility_changed')
         → ArticleService.setVisibility()
         → EventBus.emit('article:visibility-changed')
         → ArticleListStore._notify()
         → UI 重新渲染
```

### 3.2 UI 组件组织

```
js/
├── core/        AppState, EventBus, DOMRefs, AppInitializer
├── services/    ArticleService, DecoShelf, ThemeService, ApiClient
├── stores/      ArticleListStore（视图数据派生层）
├── ui/          UIController, detail, directory, articles, sidebar
├── admin/       Auth, Avatar, Panel, Position, ContextMenu
├── bootstrap/   module-registry（拓扑排序初始化）, ui-injector
└── utils/       DOM 工具, storage, toast, touch-context
```

### 3.3 目录树模块

从 400+ 行拆为 12 个子模块，每个文件职责单一：

```
js/ui/components/directory/
├── index.js                    入口，组装子模块
├── render.js                   渲染 DOM 树
├── events.js                   单击/双击/右键事件委托
├── context-menu.js             右键菜单逻辑
├── folder-state.js             折叠/展开状态
├── drag-drop.js                桌面端拖拽排序
├── directory-visibility.js     可见性切换
├── directory-drop-handler.js   拖拽放置处理
├── directory-pending-moves.js  待确认移动队列
├── directory-interactions-binder.js  交互事件绑定器
├── position-manager.js         位置管理模式（保存/恢复快照）
└── mobile-controls.js          移动端控件
```

### 3.4 多主题系统

三种主题（暗色/亮色/低保真），每个主题拆为 5 个子文件：

```
css/themes/{dark,light,lofi}/
├── _variables.css    颜色变量
├── _layout.css       布局差异
├── _content.css      文章卡片
├── _sidebar.css      侧边栏
└── _interactive.css  交互状态
```

切换时动态替换 `<link id="theme-stylesheet">` 的 href，不改 CSS 变量。设计理由：三套颜色差异过大，用变量回退的调试成本高于维护独立文件。

### 3.5 模块初始化

`AppInitializer` 使用拓扑排序保证加载顺序：

```
Config → Utils → DOMRefs → EventBus → AppState
  → UI → Watermark → Deco → Texture → HeroBackground
  → ArticleData → WebSocket → Admin
```

---

## 4. 后端架构

### 4.1 服务启动流程

```
1. require('dotenv').config()    加载环境变量
2. storage.init()                初始化存储适配器（local/rustfs）
3. 注册路由（articles/decos/settings/drafts）
4. http.createServer()           创建原生 HTTP 服务
5. initWebSocket(server)         挂载 WebSocket
6. db.initDb()                   初始化 SQLite（建表 + 迁移）
7. server.listen(9999)           开始监听
8. cleanExpiredDrafts()          3 秒后清理过期草稿
```

### 4.2 路由层

不引入 Express。自研 `enhance.cjs`（~60 行）提供：

```js
GET('/api/articles', handler)           // 精确匹配
PUT('/api/articles/:id', handler)       // 参数路由
match(method, pathname) → handler       // 运行时匹配
```

`match()` 先用精确匹配，再遍历参数路由。`send()` 统一 JSON 响应 + CORS 头。项目约 15 个端点，Express 的概念开销 > 收益。

### 4.3 数据层

sql.js（SQLite WASM）运行时，4 张表：

| 表 | 字段 | 说明 |
|----|------|------|
| `articles` | id, title, content, category, updateTime, visible | 文章 |
| `settings` | key (PK), value | 键值设置 |
| `decos` | id (PK), name, position, style, image_path | 贴纸元数据 |
| `article_drafts` | id, article_id (FK), title, content, category, saved_at | 草稿历史 |

**写入节流**：多个并发写合并为单次 `db.export()`（5 秒间隔），避免 sql.js "no transaction active" 错误。

**参数处理**：sql.js CDN 版本 `stmt.run(params)` 不执行 INSERT。全部改用 `escapeSql()` 手动转义 + `db.exec(BEGIN...COMMIT)`。

### 4.4 存储适配器

```
StorageService (门面)
├── LocalAdapter   → fs.writeFileSync / readFileSync
└── RustFSAdapter  → @aws-sdk/client-s3 (兼容 MinIO/Ceph/AWS)
```

切换：改 `.env` 中 `STORAGE_TYPE=local|rustfs` 即可，业务代码零改动。

### 4.5 主要 API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/articles` | 获取全部文章 |
| POST | `/api/articles` | 创建文章 |
| PUT | `/api/articles/:id` | 更新文章 |
| DELETE | `/api/articles/:id` | 删除文章 |
| PUT | `/api/articles/:id/visibility` | 切换可见性 |
| GET | `/api/decos` | 获取贴纸列表 |
| POST | `/api/decos` | 上传贴纸（base64 → WebP） |
| PUT | `/api/decos/:id` | 更新贴纸位置/样式 |
| DELETE | `/api/decos/:id` | 删除贴纸 |
| GET/PUT | `/api/settings` | 站点设置 |
| GET/POST/DELETE | `/api/articles/:id/drafts` | 草稿历史 |

[REVIEW] 完整端点列表见各 `backend/routes/` 文件注释。

---

## 5. 数据流

### 5.1 前端数据流

```
用户操作
  → EventBus.emit('action')
  → Service 处理（ArticleService/DecoShelf 等）
  → ApiClient 请求后端 / EventBus 发布结果
  → Store 订阅事件，派生视图数据
  → UI 组件重新渲染
```

### 5.2 后端请求流

```
HTTP 请求 → CORS 头 → 路径匹配 (match) → 参数注入 (req.params)
  → handler → db.query/run/exec → JSON 响应
  → broadcast (WebSocket) 通知其他客户端
```

### 5.3 实时同步

```
同一浏览器多标签页：BroadcastChannel('revachol')
不同客户端：WebSocket (ws) → broadcast()
```

BroadcastChannel 承载主题切换、可见性变更等轻量同步。WebSocket 仅用于服务端主动推送（文章增删改、贴纸变更）。

---

## 6. 设计决策记录

### 为什么用原生 JS 而不选框架？

- 项目最初是个人工具，不预期复杂交互
- 15 个状态键 + 5 个 UI 区域，React 的虚拟 DOM 属于过度设计
- 减少构建依赖：当前仅 Vite 做打包，无运行时框架开销
- [REVIEW] 若未来交互复杂度显著增长（如富文本编辑），可局部引入 Preact

### 为什么自研状态管理而不选 Redux？

- Redux 核心概念（action/reducer/store）对应本项目就是 EventBus + AppState，引入 Redux 等于替换一个 160 行的实现为 30KB 的库
- `AppState.commit(type, payload)` 接口与 Vuex 一致，未来若状态键增长到 50+，可无缝迁移到 Pinia

### 为什么用适配器模式处理存储？

- 开发阶段用本地文件系统（零配置），部署时可能需要 S3
- 适配器模式让 StorageService 成为统一门面，业务代码只调 `storage.upload/read/delete`
- 切换只需改 `.env` 一行

### 为什么从 BLOB 迁移到文件系统？

- sql.js 是 WASM 编译产物，Windows 下 BLOB 序列化偶发损坏
- 图片存文件系统后，读/写/备份各自独立
- `decos` 表现保留 `image_data BLOB` 列用于兼容旧数据迁移

### 为什么选择 BroadcastChannel 而非 WebSocket？

- 同一浏览器多标签页同步，BroadcastChannel 零延迟、零服务器开销
- 跨设备同步才是 WebSocket 的场景（本项目暂无此需求）
- 当前 WebSocket 仅做服务端→客户端单向广播（文章变更等）

### 为什么做 Docker 化？

- 消除"在我机器上能跑"问题：Node 版本、依赖、文件路径全封装
- 一键启动：`docker compose up -d --build`
- 安全加固：容器以 `node` 用户运行、端口默认仅绑定 localhost

---

## 7. 目录结构说明

```
revachol/
├── index.html               入口 HTML
├── js/
│   ├── app.js               应用入口（模块挂载、事件绑定）
│   ├── config.js            全局配置（API 地址、默认值）
│   ├── core/                基础设施（状态、事件、DOM 引用）
│   ├── services/            业务逻辑（与后端通信 + 领域逻辑）
│   ├── stores/              视图数据派生层
│   ├── ui/components/       UI 组件（按功能域划分）
│   ├── admin/               管理模块（认证、面板、贴纸管理）
│   ├── editor/              文章编辑器（独立页面）
│   ├── mobile/              移动端适配
│   ├── bootstrap/           启动引导（模块注册、UI 文案注入）
│   └── utils/               工具函数
├── css/                     样式
│   ├── base/                重置 + 变量 + 布局
│   ├── components/          组件样式
│   ├── themes/{dark,light,lofi}/ 主题
│   │   └── _*.css           按功能域拆分
│   ├── pages/editor/        编辑器独立样式
│   └── utilities/           动画 + 响应式
├── backend/
│   ├── server.cjs           入口
│   ├── enhance.cjs          路由/响应工具
│   ├── db.cjs               SQLite 封装
│   ├── routes/              路由处理器
│   ├── storage/             存储适配器
│   └── uploads/decos/       贴纸文件
├── docs/                    文档
│   ├── architecture/        架构文档
│   ├── deployment/          部署指南
│   ├── development/tools/   工具文档
│   └── node-22-upgrade-review.md
├── tests/                   单元测试
├── docker-compose.yml
├── Dockerfile / Dockerfile.frontend
└── package.json
```

**新增功能指南**：
- 新 UI 组件 → `js/ui/components/`
- 新业务逻辑 → `js/services/`
- 新 API 端点 → `backend/routes/` + `server.cjs` 注册
- 新状态键 → `js/core/state-mutations.js` + `js/core/app-state.js`

---


