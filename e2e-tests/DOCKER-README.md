# REVACHOL Docker E2E 测试环境

基于 Docker Compose 的 Playwright 端到端测试环境，与现有前端/后端服务协同工作。

## 架构概述

```
┌────────────────────────────────────────────────────┐
│                  Docker Network                     │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ backend  │  │ frontend │  │ playwright-tests │ │
│  │ Node:22  │  │ Vite:3000│  │ Playwright+Chrm  │ │
│  │ :9999    │  │ ──proxy──│  │                  │ │
│  │ sql.js   │  │   → api  │  │ 访问 frontend:   │ │
│  │          │  │          │  │ 3000 运行测试     │ │
│  └──────────┘  └──────────┘  └──────┬───────────┘ │
│                                      │              │
│                            volumes:  │              │
│                            ┌─────────┴──────────┐  │
│                            │ ./playwright-report│  │
│                            │ ./test-results     │  │
│                            │ ./run-history      │  │
│                            └────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- **backend**：Node.js 后端（API + WebSocket），端口 9999
- **frontend**：Vite 开发服务器，端口 3000，通过代理转发 `/api/*` 到后端
- **playwright-tests**：Playwright 测试容器，访问 `http://frontend:3000` 运行 E2E 测试
- 测试结果通过 bind mount 持久化到宿主机

## 快速开始

```bash
# 1. 构建并启动测试（一键脚本）
bash scripts/run-e2e-in-docker.sh --build --archive

# 2. 或手动分步执行
docker compose build playwright-tests
docker compose up -d backend frontend
docker compose run --rm playwright-tests
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `bash scripts/run-e2e-in-docker.sh` | 运行测试（不重建镜像） |
| `bash scripts/run-e2e-in-docker.sh --build` | 重建镜像并运行测试 |
| `bash scripts/run-e2e-in-docker.sh --archive` | 运行测试并归档报告 |
| `bash scripts/run-e2e-in-docker.sh --ci` | CI 模式：测试失败立即退出 |
| `bash scripts/run-e2e-in-docker.sh --archive --serve` | 测试 → 归档 → 启动仪表盘 |
| `npm run test:e2e:docker` | npm 脚本快捷方式 |
| `npm run test:e2e:docker:archive` | npm 脚本：测试 + 归档 + 仪表盘 |

## 查看报告

```bash
# 最新 HTML 报告（在浏览器中直接打开）
# Windows: start playwright-report/index.html
# macOS:   open playwright-report/index.html
# Linux:   xdg-open playwright-report/index.html

# 或在 Docker 内启动 playwright-archive 仪表盘
npm run test:e2e:serve
# 访问 http://localhost:3200
```

## 调试测试失败

### 1. 查看测试容器日志

```bash
docker compose logs playwright-tests
```

### 2. 查看失败截图和录像

失败截图和录像保存在：
- 截图：`test-results/` 目录下
- 录像：失败用例会自动保存 `.webm` 文件

### 3. 进入测试容器交互式调试

```bash
# 启动容器并进入 shell
docker compose run --rm --entrypoint /bin/bash playwright-tests

# 在容器内手动运行单个测试文件
npx playwright test e2e-tests/auth.spec.js --config playwright.docker.config.js

# 查看详细输出
npx playwright test --config playwright.docker.config.js --reporter=list
```

### 4. 查看依赖服务日志

```bash
docker compose logs backend   # 后端日志
docker compose logs frontend  # 前端日志
```

## 配置文件说明

| 文件 | 用途 |
|---|---|
| `Dockerfile.test` | 测试容器镜像定义（基于 Playwright 官方镜像） |
| `e2e-tests/playwright.docker.config.js` | Docker 专用 Playwright 配置 |
| `scripts/run-e2e-in-docker.sh` | 一键测试启动脚本 |
| `docker-compose.yml` | 新增 `playwright-tests` 服务定义 |

### Docker 配置与本地配置的差异

| 配置项 | 本地 | Docker |
|---|---|---|
| 超时时间 | 30s | 60s（容器稍慢） |
| 无头模式 | 本地有头/CI 无头 | 始终无头 |
| 重试次数 | 0 | 1 |
| webServer | 自动启动 Vite | undefined（前端容器独立运行） |
| baseURL | localhost:3000 | frontend:3000 |
| 录像 | 关闭 | retain-on-failure |

## 常见问题

### 测试容器启动失败：找不到 playwright.docker.config.js

确保 `e2e-tests/playwright.docker.config.js` 文件存在。Dockerfile.test 会复制整个 `e2e-tests/` 目录。

### 前端服务无法访问

检查 Docker 网络：
```bash
docker compose ps              # 确认 backend 和 frontend 都在运行
docker compose exec frontend curl -s http://backend:9999/api/articles  # 测试连通性
```

### 卷权限问题（Linux）

如果报告文件无法写入，检查宿主机目录权限：
```bash
# 确保目录存在且有写入权限
mkdir -p playwright-report test-results run-history
chmod 777 playwright-report test-results run-history
```

或使用宿主用户 UID 运行容器：
```bash
UID=$(id -u) GID=$(id -g) docker compose run --rm playwright-tests
```

### 镜像构建缓存问题

如果修改了 package.json 或配置但未生效：
```bash
docker compose build --no-cache playwright-tests
```

### 仅重建测试镜像

```bash
docker compose build playwright-tests
```
