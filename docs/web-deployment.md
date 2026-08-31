# Web 管理系统部署

Web 管理系统通过普通浏览器访问，默认监听 `127.0.0.1:8787`。账户、Cookie、Token 和设置以加密文档形式保存在 SQLite 中。

## Docker Compose

生产 Compose 只使用 GitHub Actions 发布到 GHCR 的镜像，不在部署主机上构建源码。默认镜像为
`ghcr.io/planetsider/api-master:latest`；建议将 `AAH_IMAGE_TAG` 固定为发布版本或提交 SHA，并在升级时显式更新。

创建 Compose secret 文件：

```text
secrets/
├── admin_password.txt
├── session_secret.txt
└── encryption_key.txt
```

- `admin_password.txt`：Web 登录密码。
- `session_secret.txt`：至少 32 个随机字符，用于签名登录会话。
- `encryption_key.txt`：独立随机秘密，用于加密持久化数据。

然后启动：

```bash
docker compose pull
docker compose up -d
```

访问 `http://127.0.0.1:8787`。默认只绑定回环地址；需要通过反向代理访问时，由代理负责 TLS，并将 `AAH_WEB_SECURE_COOKIES` 设置为 `true`。不要直接把未启用 HTTPS 的服务暴露到公网。

数据存放在 `all-api-hub-data` 命名卷中。更新镜像：

```bash
docker compose pull
docker compose up -d
```

如果使用自己的 GitHub 镜像仓库，设置 `AAH_IMAGE_REPOSITORY`。私网上游默认被 SSRF 防护拒绝；服务端会在请求前解析域名，并将已验证的地址固定到 HTTP 连接，避免 DNS rebinding 在校验后改指向私网。仅在已审查网络边界后设置
`AAH_WEB_ALLOW_PRIVATE_UPSTREAMS=true`。该开关同时影响账户请求、托管站点、模型目录、WebDAV 和外部通知目标，不能替代网络层隔离。

## 本地开发

```bash
pnpm install
pnpm dev:web
```

前端开发地址为 `http://127.0.0.1:5173`，API 为 `http://127.0.0.1:8787`。非生产模式在回环地址提供仅供开发的默认密码 `admin`；不得在共享环境使用该默认值。

生产构建与启动：

```bash
pnpm build:web:all
pnpm start:web
```

生产模式必须配置 `AAH_WEB_ADMIN_PASSWORD`、`AAH_WEB_SESSION_SECRET` 和 `AAH_WEB_ENCRYPTION_KEY`，或对应的 `*_FILE` 变量。

## 数据迁移

登录 Web 管理系统后，使用“导入”选择扩展导出的 JSON 备份。服务端会运行现有账户迁移和规范化逻辑，再加密写入 SQLite。导入采用乐观版本控制；页面数据已变化时会拒绝覆盖并要求重新加载。

扩展备份中的账户、书签、标签、API 凭据、可迁移的显示偏好（主题、币种、排序、今日明细和健康列）以及资源级频道模型过滤规则会被导入。浏览器专属的当前标签页、扩展弹窗/侧边栏行为、浏览器通知权限、页面会话和临时过盾设置不会伪装成 Web 能力；这些字段会被忽略并在“显示偏好”中列出。

“导出”生成带版本的完整 Web 备份，包含账户、Web 显示偏好、自动化设置、频道过滤、余额和用量历史、通知、托管站点以及 WebDAV 配置。该 JSON 包含解密后的敏感凭据，只能存放在可信位置。恢复完整备份会在单个 SQLite 事务内替换现有服务端状态；界面会在写入前要求确认。

Web 管理系统提供以下主要 HTTP 接口：`/api/accounts`、`/api/managed-sites`、`/api/settings/preferences`、`/api/channel-configs`、`/api/history/*`、`/api/backup` 和 `/api/settings/webdav`。所有非健康检查接口都需要登录会话；写操作使用 CSRF 校验和文档版本号防止并发覆盖。

## WebDAV 备份

登录后打开“WebDAV”，配置 HTTP(S) 地址、用户名和密码。地址可以是现有 JSON 文件，也可以是目录；目录模式会使用 `all-api-hub-backup/all-api-hub-web-1.json`。支持连接测试、立即上传、远端恢复和最短 15 分钟的服务端自动备份。

建议启用“加密远端备份”并使用独立于 Web 登录密码和 WebDAV 密码的加密密码。该密码只加密远端备份内容；服务端 SQLite 仍由 `AAH_WEB_ENCRYPTION_KEY` 加密。遗失备份加密密码后无法恢复远端加密文件。

## 外部通知

登录后打开“外部通知”，可配置 Telegram、飞书、钉钉、企业微信、ntfy 或通用 Webhook。服务端只返回渠道是否已配置，不会把 Bot Token、Webhook Key、Secret 或访问 Token 返回给浏览器；在已保存配置上点击“测试”即可验证投递。

通知总开关和事件开关独立于渠道开关。可分别选择账户刷新、自动签到、用量历史、余额历史和 WebDAV 备份的结果是否发送。第三方服务地址由服务端发起请求，部署到公网前应限制出站网络并审查自定义 Webhook 目标。

当前 Web 路径已支持账户列表、搜索、添加、启停、删除、书签管理（置顶和浏览器新标签页打开）、显示偏好、托管站点渠道和模型过滤、完整备份恢复、WebDAV、单账户/批量刷新、自动刷新，以及手动/定时签到。标准 HTTP 协议可直接在服务端运行；需要扩展标签页、Cookie 仓库、WAF 临时窗口或 Turnstile 的流程会明确标记为需要浏览器工作节点，不能视为已经与扩展功能对等。
