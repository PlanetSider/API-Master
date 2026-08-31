# All API Hub

All API Hub 是一个自托管的 AI 中转站账号与 API 凭据管理系统。当前推荐通过 Docker Compose 启动服务，再使用普通浏览器访问 Web 管理界面。账号、凭据、历史记录、设置和通知保存在加密 SQLite 数据中。

## 功能范围

- 管理 New API、OneHub、DoneHub、Veloera、Sub2API 等兼容站点账号。
- 查看余额、用量、模型目录和价格，执行单个或批量刷新及签到。
- 管理 API 凭据、密钥、托管站点、渠道模型过滤和模型同步。
- 使用 JSON 或 `.env` 导出凭据，进行完整备份与恢复。
- 配置 WebDAV 备份、自动化任务和 Telegram、飞书、钉钉、企业微信、ntfy 或 Webhook 通知。

Web 服务不能读取运行它的电脑上的浏览器 Cookie 仓库、当前标签页或页面会话，也不能直接执行 Cloudflare/Turnstile 挑战和页面按钮操作。这些浏览器专属流程仍由扩展或受控浏览器工作节点负责；未配置工作节点时，Web 界面会明确显示不可用。

## 快速部署

准备 Docker Engine、Docker Compose v2 和一个可访问 GHCR 的环境。生产部署使用 GitHub Actions 自动发布的镜像，不需要在服务器上安装 Node.js 或构建源码。

```bash
mkdir -p data
# 请先编辑 compose.yaml，替换其中的三个生产环境秘密。

docker compose pull
docker compose up -d
```

Windows 用户可在 Git Bash 或 WSL 中执行上述命令；也可以手动创建 `data` 目录并编辑 `compose.yaml`。若 GHCR 镜像为私有仓库，请先执行 `docker login ghcr.io`。

浏览器打开 <http://127.0.0.1:8787>，使用 `compose.yaml` 中 `AAH_WEB_ADMIN_PASSWORD` 的值登录。部署到远程主机时，建议直接修改 `compose.yaml` 中的 `image` 行，固定到发布版本或提交 SHA：

```yaml
image: ghcr.io/planetsider/api-master:sha-2d468577
```

也可以使用发布版本标签；不要长期依赖 `latest`。完整环境变量和迁移说明见 [`docs/web-deployment.md`](./docs/web-deployment.md)。

## 常用操作

```bash
docker compose ps              # 查看服务状态
docker compose logs -f web     # 查看实时日志
docker compose pull            # 拉取新镜像
docker compose up -d           # 升级并重新创建服务
docker compose stop            # 暂停服务
docker compose start           # 恢复服务
```

Compose 将数据库直接保存到项目下的 `data/` 宿主机目录。`docker compose down` 不会删除该目录；如需清理数据，必须在确认备份后手动删除 `data/`。日常备份优先使用 Web 界面的“导出”或 WebDAV 功能，导出的 JSON 可能包含解密后的敏感凭据。

## 首次使用

1. 登录后在“账号管理”中添加站点地址、账号凭据，或导入已有 JSON 备份。
2. 执行刷新，确认余额、用量和模型可用性；需要时开启自动刷新或定时签到。
3. 在“API 凭据”中保存独立的 Base URL 和 API Key，并按需导出 JSON 或 `.env`。
4. 在“托管站点”中配置自建网关、渠道和模型同步。
5. 在“备份 / WebDAV”中设置远端备份，在“通知”中配置任务结果提醒。

## 配置与安全

- 默认仅绑定 `127.0.0.1:8787`。通过反向代理提供公网访问时必须启用 HTTPS，并将 `compose.yaml` 中的 `AAH_WEB_SECURE_COOKIES` 改为 `"true"`。
- `compose.yaml` 中的 `AAH_WEB_SESSION_SECRET` 与 `AAH_WEB_ENCRYPTION_KEY` 必须是不同的随机值，且生产环境至少 32 个字符；这三个值会出现在配置文件和 `docker inspect` 输出中，请勿提交包含真实值的 Compose 文件。
- `AAH_WEB_ALLOW_PRIVATE_UPSTREAMS` 默认关闭；只有审查网络边界后才将 `compose.yaml` 中的值改为 `"true"`。
- 不要提交密码、Token、Cookie、WebDAV 凭据或备份 JSON 到 Git 仓库，也不要挂载 Docker Socket。

## 本地开发

项目使用 `.nvmrc` 指定的 Node.js 24 和 pnpm 10：

```bash
corepack enable
pnpm install
pnpm dev:web          # Web 开发服务：http://127.0.0.1:5173
pnpm build:web:all    # 构建前端和服务端
pnpm start:web        # 启动已构建服务
pnpm test             # 运行单元测试
```

提交代码前请阅读 [`AGENTS.md`](./AGENTS.md)，并根据改动运行相应的测试和类型检查。

## 相关链接

- [Web 部署与数据迁移](./docs/web-deployment.md)
- [安全策略](./SECURITY.md)
- [GitHub Actions 镜像构建](https://github.com/PlanetSider/API-Master/actions/workflows/web-container.yml)
- [项目仓库](https://github.com/PlanetSider/API-Master)
