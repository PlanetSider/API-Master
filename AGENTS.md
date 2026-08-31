# 仓库指南

本项目 API-Master 正在从浏览器扩展发展为可由普通浏览器直接访问的 Web 管理系统，同时保留扩展兼容路径。新增代码、文档和配置应优先服务 Web 使用场景，并遵循现有模块边界。

## 项目结构

- `web/`：React Web 界面、对话框和类型化 HTTP 客户端。
- `server/`：Hono API、认证、加密存储、账户与设置仓库、任务调度及上游适配器。
- `src/`：WXT 扩展入口，以及可复用的领域逻辑、适配器和协议实现。
- `tests/`、`e2e/`：Vitest/Testing Library 单元与组件测试，以及 Playwright 浏览器流程。
- `compose.yaml`、`Dockerfile`、`.github/workflows/`：Compose 部署、镜像构建和发布配置。

## 迁移状态与功能边界

- Web 端已经覆盖账户、凭据、模型、密钥、托管站点、历史、通知、自动化、备份和 WebDAV 等核心管理流程；新增管理功能默认实现为 Web API 与 Web UI。
- `src/entrypoints/` 及 `src/features/` 仍是扩展兼容路径，不要为了复用界面而让 `web/` 或 `server/` 依赖扩展入口。
- 本地浏览器 Cookie 仓库、当前标签页、页面会话、WAF/Cloudflare 挑战、Turnstile 和页面原生操作目前属于浏览器工作节点能力；未配置工作节点时必须明确报告不可用，不能伪装成服务端功能。
- Web 凭据导出目前以 JSON 和 `.env` 文件为主。Cherry Studio、CC Switch、Kelivo、Cursor+、Kilo Code、CLIProxyAPI、Claude Code Router 等扩展集成未在 Web 中默认视为等价完成；新增支持时应同时补充契约、下载内容、脱敏提示和测试。
- 任何迁移功能都要说明执行方（服务端或浏览器工作节点），并同步更新 `src/web/contracts.ts`、运行能力接口和部署文档。

## 开发与校验命令

使用 `.nvmrc` 指定的 Node.js 和 pnpm 10+。常用命令如下：

```text
pnpm install                 安装项目依赖
pnpm dev:web                 启动 Web 开发环境
pnpm build:web:all           构建 Web 前端与服务端
pnpm start:web               运行已构建的 Web 服务
pnpm compile:web             执行 Web 类型检查
pnpm test                    运行 Vitest 测试
pnpm e2e                     运行 Playwright 测试
pnpm lint                    执行 ESLint 检查
pnpm format:check            检查 Prettier 格式
```

提交前先运行与改动相关的测试；若涉及共享契约、导出、依赖或仓库结构，再运行 `pnpm run validate:push`。

## 编码与测试约定

使用 TypeScript 和 React，采用 2 个空格缩进、双引号且不加分号，并遵循 Prettier/ESLint。`src/` 内优先使用 `~/` 导入别名。测试文件命名为 `*.test.ts` 或 `*.test.tsx` 并放在 `tests/`；新增可执行逻辑应覆盖成功、错误和边界情况。纯函数优先使用 Vitest，只有真实浏览器扩展或跨页面流程才使用 E2E。

## Web 架构与安全

Web 界面只能调用类型化服务端 API，不得读取扩展存储、秘密或调用 `browser.*`/`chrome.*`。服务端负责认证、秘密处理、持久化、调度和上游请求；敏感值只在明确的单次操作中返回。所有上游地址都必须经过 SSRF 校验。Compose 镜像由 GitHub Actions 构建并发布，部署端使用版本化镜像；状态放入命名卷或外部数据库，凭据通过环境变量或 Compose secrets 提供。禁止挂载 Docker Socket。

## 提交与合并请求

提交信息使用约定式格式，例如 `feat(web): 新增账户筛选`、`fix(server): 处理空响应`。合并请求应说明目的、行为变化、测试命令和安全影响；涉及界面时附截图，涉及配置或数据迁移时同步更新文档与 `.env.example`。严禁提交密钥、Token、Cookie 或本地数据。
