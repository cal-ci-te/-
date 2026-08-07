请根据以下项目文档，为 REVACHOL 项目生成 8 个核心模块的摘要。

## 文档来源
- 架构文档：docs/architecture/README.md（已提供完整架构说明）
- 自定义图标指南：docs/development/custom-icon-guide.md
- 部署文档：docs/deployment/docker-setup.md
- 工具链文档：docs/development/tools/index.md
- 测试文档：docs/development/tools/vitest.md
- 错误监控文档：docs/development/tools/errpulse.md
- Node 升级审查：docs/node-22-upgrade-review.md
- 路线图：docs/roadmap.md
- 拼图的渐进式修改：docs\development\phase-1-refactor.md，docs\development\phase-2-puzzle-customizer.md，docs\development\phase-3-cleanup.md

## 项目核心信息（从文档提取）
- 项目名称：REVACHOL
- 版本：v1.9.0
- 技术栈：原生 ES Module + Vite（前端），Node.js 22 + 原生 http + sql.js（后端）
- 架构分层：前端（core/services/stores/ui），后端（routes/storage/db），存储适配器（local/S3）

## 需要生成摘要的 8 个模块

1. M1 - ArticleService（数据层）
   - 文件：js/services/ArticleService.js
   - 职责：文章/分类 CRUD，单一数据源
   - 关键：数据结构、公开方法、触发事件、依赖

2. M2 - AppState + EventBus（状态管理）
   - 文件：js/core/AppState.js, js/core/EventBus.js
   - 职责：集中式 state + mutation 提交，发布-订阅跨模块通信
   - 关键：状态键列表、事件常量域（40个）、订阅机制

3. M3 - 目录树模块
   - 文件：js/ui/components/directory/（12个子模块）
   - 职责：折叠展开、拖拽排序、右键菜单、位置管理
   - 关键：子模块列表、外部依赖、关键交互事件

4. M4 - 贴纸系统和拼图
   - 文件：js/ui/components/deco/ + backend/routes/decos.js+js\puzzle
   - 职责：上传（自动压缩为 WebP）、管理、位置编辑、存储
   - 关键：存储方式（本地/S3）、渲染逻辑、位置管理

5. M5 - 主题系统
   - 文件：css/themes/（暗色/亮色/低保真，各5个子文件）
   - 职责：三套主题动态切换，CSS变量驱动
   - 关键：切换机制、变量体系、动态加载方式

6. M6 - 后端路由层
   - 文件：backend/routes/ + enhance.cjs
   - 职责：自研路由匹配、CORS、参数注入、统一响应
   - 关键：主要端点列表（articles/decos/settings/drafts）

7. M7 - 存储适配器
   - 文件：backend/storage/（LocalAdapter + RustFSAdapter）
   - 职责：本地文件系统 ↔ S3 兼容存储无缝切换
   - 关键：适配器接口、切换方式（.env一行）、业务代码零感知

8. M8 - 文章编辑器（独立页面）
   - 文件：js/admin/ + article-editor.html
   - 职责：独立编辑页面，与主页面实时同步
   - 关键：BroadcastChannel通信、主题同步、草稿保存

## 输出要求

每个摘要使用以下固定格式（严格遵循，不要额外内容）：