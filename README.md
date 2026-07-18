# REVACHOL

原创角色档案馆，一个带内容管理、贴纸装饰、水印保护、多主题切换的 Web 应用。

当前版本：v1.0.0

---

## 预览

| 主题 | 截图 |
|------|------|
| 暗色 | ![暗色](images/screenshots/dark.png) |
| 亮色 | ![亮色](images/screenshots/light.png) |
| 低保真 | ![低保真](images/screenshots/lofi.png) |

| 功能 | 截图 |
|------|------|
| 目录树 | ![目录树](images/screenshots/tree.png) |
| 贴纸系统 | ![贴纸系统](images/screenshots/deco.png) |
| 移动端 | ![移动端](images/screenshots/mobile.png) |

---

## 功能

- 文章：增删改查、分类管理、可见性控制、无限滚动
- 目录树：折叠展开、拖拽排序、右键菜单
- 详情页：标签页模式、全屏、最小化
- 贴纸：上传（自动压缩为 WebP）、管理、位置编辑
- 主题：暗色、亮色、低保真三套
- 管理面板：登录、头像、背景、纹理、水印、色卡
- 移动端：响应式布局、触摸拖拽、长按菜单

---

## 技术栈

前端：原生 ES Module、Vite、自研状态管理（AppState + EventBus）
后端：Node.js + 原生 http、SQLite、WebSocket
存储：本地文件系统 / S3 兼容对象存储（适配器模式切换）
监控：ErrPulse
测试：Vitest + jsdom

---

## 项目结构
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


---

## 快速开始

环境：Node.js 18+

```bash
# 前端
npm install
npm run dev

# 后端
cd backend
npm install
node server.cjs
```

管理员账号：admin / admin123

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

目录树模块化：从 400+ 行拆分为 12 个职责单一的模块。

单向数据流：ArticleService 为唯一数据源，ArticleListStore 派生数据无副本。

多主题系统：CSS 变量驱动，三套主题动态加载。

## 后续计划

补充 UI 自动化测试

文章全文搜索

Docker 部署

多语言支持

优化目录字体，美化低保真界面的按钮和布局，优化交互效果
