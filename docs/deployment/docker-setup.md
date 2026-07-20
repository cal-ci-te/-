# REVACHOL Docker 部署指南

> 版本：v1.7.0
> 最后更新：2026-07-20

---

## 1. 前置条件

### 必需软件

| 软件 | 最低版本 | 说明 |
|------|----------|------|
| Docker Desktop | 24.0+ | 含 Docker Compose V2（`docker compose` 命令） |
| Git | 2.30+ | 克隆仓库（可选，也可直接下载源码） |

### 系统要求

- **Windows**：Windows 10 22H2+ / Windows 11，启用 WSL 2
- **macOS**：macOS 12 Monterey+（Intel / Apple Silicon 均可）
- **Linux**：内核 4.18+，安装 Docker Engine + Docker Compose V2

### 安装后检查

```bash
docker --version        # 应显示 24.x 或更高
docker compose version  # 应显示 v2.x
```

### Windows 用户特别注意

1. Docker Desktop 使用 WSL 2 引擎，项目目录需在 WSL 可访问的路径下
2. **项目路径请勿包含中文**，否则 Docker 挂载卷可能失败（详见第 6 章）
3. 建议在 Docker Desktop Settings → Resources → File Sharing 中确认项目所在盘符已添加

---

## 2. 快速启动

### 首次启动

```bash
# 1. 进入项目根目录
cd revachol

# 2. 构建镜像并启动（首次需下载基础镜像 + npm install，约 2-5 分钟）
docker compose up -d --build

# 3. 检查运行状态（两个服务均显示 "running" 即成功）
docker compose ps
```

### 后续启动

```bash
# 已构建过镜像后，直接启动（跳过构建步骤）
docker compose up -d

# 或：代码有变更需要重新构建
docker compose up -d --build
```

### 前台运行（调试用）

```bash
# 前台运行，日志实时输出到终端，Ctrl+C 停止
docker compose up
```

### 停止服务

```bash
# 停止但保留数据卷
docker compose down

# 停止并删除数据卷（⚠️ 数据库和贴纸将被清空）
docker compose down -v
```

---

## 3. 常用命令速查

| 操作 | 命令 |
|------|------|
| 启动（后台） | `docker compose up -d` |
| 启动并强制重建 | `docker compose up -d --build` |
| 停止 | `docker compose down` |
| 停止并清空数据 | `docker compose down -v` |
| 查看运行状态 | `docker compose ps` |
| 查看全部日志 | `docker compose logs` |
| 实时跟踪日志 | `docker compose logs -f` |
| 只看后端日志 | `docker compose logs -f backend` |
| 只看前端日志 | `docker compose logs -f frontend` |
| 重启后端 | `docker compose restart backend` |
| 重启前端 | `docker compose restart frontend` |
| 进入后端容器 | `docker compose exec backend sh` |
| 进入前端容器 | `docker compose exec frontend sh` |
| 仅在后台构建 | `docker compose build --no-cache` |

---

## 4. 服务访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | `http://localhost:3000` | Vite 开发服务器 |
| 后端 API | `http://localhost:9999` | REST + WebSocket |
| API 示例 | `http://localhost:9999/api/articles` | 返回文章 JSON 列表 |
| ErrPulse 仪表盘 | `http://localhost:3800` | [REVIEW] 需在宿主机启动 ErrPulse 服务 |

### 管理员登录

访问 `http://localhost:3000`，点击右上角头像区域，使用默认账号：

- 用户名：`admin`
- 密码：`admin123`

---

## 5. 数据持久化

### 数据卷说明

项目使用两个 Docker 命名卷存储持久化数据（定义于 `docker-compose.yml`）：

| 卷名 | 挂载路径 | 内容 |
|------|----------|------|
| `revachol_revachol_data` | `/app/data` | SQLite 数据库文件 `revachol.db` |
| `revachol_revachol_uploads` | `/app/uploads` | 贴纸图片（WebP 格式） |

### 备份数据

```bash
# 查看数据卷位置（Docker Desktop）
docker volume inspect revachol_revachol_data

# Linux/macOS：卷数据通常在 /var/lib/docker/volumes/ 下
# Windows WSL 2：通过 \\wsl$\docker-desktop-data 访问

# 简单备份：从容器中复制文件
docker compose exec backend cp /app/data/revachol.db /tmp/
docker compose cp backend:/tmp/revachol.db ./revachol-backup-$(date +%Y%m%d).db

# 贴纸备份
docker compose exec backend tar -czf /tmp/uploads-backup.tar.gz /app/uploads/
docker compose cp backend:/tmp/uploads-backup.tar.gz ./uploads-backup-$(date +%Y%m%d).tar.gz
```

### 重置数据

```bash
# 停止并删除数据卷，重启后自动初始化空数据库
docker compose down -v
docker compose up -d --build
```

---

## 6. 常见问题排查

### 端口冲突

**现象：**

```
Error: port is already allocated
或启动后前端/后端无法访问
```

**可能原因：** 宿主机 3000 或 9999 端口已被占用（如本地 Vite 开发服务器、其他 Docker 容器）。

**解决步骤：**

```bash
# 1. 查看端口占用
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :9999

# macOS/Linux
lsof -i :3000
lsof -i :9999

# 2. 停止占用进程，或修改 docker-compose.yml 中的端口映射
#    例如改为 3001:3000（宿主 3001 → 容器 3000）
ports:
  - "3001:3000"
```

---

### 中文路径问题（Windows）

**现象：**

```json
{
  "error": "The system cannot find the file specified"
}
```

容器启动后立即退出，日志中出现挂载错误。

**可能原因：** 项目路径包含中文字符，Docker + WSL 2 无法正确处理 Unicode 路径挂载。

**解决步骤：**

1. 将项目移动到纯英文路径，例如 `C:\Projects\revachol`
2. 重启 Docker Desktop
3. 如有必要，在 Docker Desktop Settings → Resources → File Sharing 中添加新路径

---

### 构建失败（网络问题）

**现象：**

```
npm ERR! network timeout
npm ERR! fetch failed
或下载缓慢超过 5 分钟
```

**可能原因：** Docker 容器内 npm 默认 registry 在国内访问缓慢。

**解决步骤：**

```bash
# 方案 1：使用国内镜像源（推荐）
# 在 Dockerfile 的 RUN npm install 之前添加：
RUN npm config set registry https://registry.npmmirror.com

# 方案 2：宿主机配置 Docker 代理
# Docker Desktop → Settings → Resources → Proxies
# 设置 HTTP 和 HTTPS 代理
```

---

### 容器启动后立即退出

**现象：**

```
docker compose ps 显示状态为 "exited"
或 UP 几秒后变成 exited
```

**可能原因：** 后端启动失败（数据库初始化错误、端口已被占用、`backend/.env` 缺失等）。

**解决步骤：**

```bash
# 1. 查看退出容器的日志
docker compose logs backend

# 2. 常见日志关键字及含义：
#    "[DB] 初始化失败" → 数据库文件损坏或权限问题
#    "EADDRINUSE" → 端口被占用
#    "Cannot find module" → 依赖未正确安装

# 3. 尝试清理后重建
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

---

### 数据库连接失败

**现象：**

```
[DB] 初始化失败
或前端页面无法加载数据，API 返回 500
```

**可能原因：** 数据库文件路径不正确、文件权限问题、挂载卷冲突。

**解决步骤：**

```bash
# 1. 检查 docker-compose.yml 中环境变量
# DB_PATH=/app/data/revachol.db  应对应卷挂载的路径

# 2. 进入容器检查
docker compose exec backend sh
ls -la /app/data/
# 应能看到 revachol.db 文件

# 3. 如果文件不存在或损坏，重建
docker compose down -v
docker compose up -d --build
```

---

### 前端无法访问后端

**现象：**

前端页面正常显示，但无文章数据；浏览器开发者工具 Network 标签显示 `/api/articles` 请求 404 或连接拒绝。

**可能原因：** Vite proxy 未正确指向后端容器。

**解决步骤：**

```bash
# 1. 检查 docker-compose.yml 中 frontend 的 VITE_BACKEND_URL
environment:
  - VITE_BACKEND_URL=http://backend:9999

# 2. 验证后端容器网络可达
docker compose exec frontend sh
wget -qO- http://backend:9999/api/articles
# 应返回 JSON 数据

# 3. 检查 vite.config.js 中的 proxy 配置
# 应使用 VITE_BACKEND_URL 环境变量
```

---

### 宿主机文件变更后容器未更新

**现象：**

修改了 `js/` 或 `css/` 下的文件，但浏览器中页面未变化。

**可能原因：** Docker Compose 使用了卷挂载（`.:/app`），但 HMR 热更新需要 `usePolling` 设置。

**解决步骤：**

```bash
# 1. 确认 docker-compose.yml 包含卷挂载：
volumes:
  - .:/app          # 宿主机 . → 容器 /app
  - /app/node_modules  # 保护容器内 node_modules

# 2. vite.config.js 已配置 usePolling: true，应自动检测文件变更
#    如果仍未生效，重启前端容器：
docker compose restart frontend
```

---

## 7. 性能与资源建议

### Docker Desktop 资源分配

| 设置 | 建议值 | 说明 |
|------|--------|------|
| CPU | 2 cores | 最低可 1 core，2 core 保证 npm install 速度 |
| 内存 | 4 GB | [REVIEW] 如运行多个容器可适当增加 |

### 磁盘空间

| 项目 | 大小 |
|------|------|
| `node:22-alpine` 基础镜像 | ~50 MB |
| 后端镜像（含 node_modules） | ~200 MB |
| 前端镜像（含 node_modules） | ~400 MB |
| SQLite 数据库 | 视文章数量，一般 < 10 MB |
| 贴纸图片 | 视上传数量，单张约 50-200 KB（WebP 压缩） |

**建议定期清理无用镜像：**

```bash
docker system prune -f     # 清理停止的容器、无标签镜像
docker volume prune -f     # 清理未使用的卷（⚠️ 注意备份数据）
```
