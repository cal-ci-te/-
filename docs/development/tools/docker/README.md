# Docker Compose — 容器化环境

用于本地开发和部署的容器化方案，一键启动前后端双容器。

## 快速开始

```bash
# 构建并后台启动
docker compose up -d --build

# 停止（保留数据）
docker compose down

# 停止并清空数据（⚠️ 数据库和贴纸被删除）
docker compose down -v

# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f
```

## 配置说明

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 服务编排、端口、卷、环境变量 |
| `Dockerfile` | 后端镜像（Node 22、非 root 用户） |
| `Dockerfile.frontend` | 前端镜像（Vite 开发服务器） |

关键环境变量（`docker-compose.yml`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BIND_ADDR` | `127.0.0.1` | 端口绑定地址，云服务器设为 `0.0.0.0` |
| `STORAGE_TYPE` | `local` | 存储模式，可选 `local` 或 `rustfs` |
| `DB_PATH` | `/app/data/revachol.db` | 数据库文件路径 |
| `VITE_BACKEND_URL` | `http://backend:9999` | Vite 代理目标（Docker 内部网络） |

## 常见问题

### 端口被占用

```bash
# [REVIEW] Windows 查看端口占用
netstat -ano | findstr :3000

# 修改 docker-compose.yml 中端口映射
ports:
  - "3001:3000"  # 宿主机 3001 → 容器 3000
```

### 容器启动后立即退出

```bash
docker compose logs backend  # 查看错误日志
```

常见原因：卷权限问题（旧版本升级后）。解决：`docker compose down -v && docker compose up -d --build`。

### 构建时 npm install 超时

镜像加速已配置 `docker.xuanyuan.me`。若仍超时，检查 Docker Desktop → Settings → Docker Engine 中的 `registry-mirrors` 配置。
