# @hmilyld/dsh-opencode-import

[English](README.md) | 中文

DSH（DeepSeek Harness）插件：把一个工作区里的 OpenCode 对话导入 DSH 的**工作区会话列表**，成为**真实、可打开的 DSH 会话**。导入后的会话就是普通的 DSH 会话日志：出现在侧栏对应工作区分组下、用正常会话视图打开、可被搜索，也可以继续对话。

```text
工作区：~/Codespace/my-app
  ├─ session-…            普通 DSH 会话
  ├─ session-oc-9f2c…     从 OpenCode 导入
  └─ session-oc-31ab…     从 OpenCode 导入
```

Host 侧只读打开 OpenCode 的 SQLite 库，把每个对话映射成 DSH 会话事件，写入真实的会话日志，预热投影缓存让侧栏直接显示 OpenCode 的标题，再把会话挂到匹配的工作区。浏览器侧负责设置页、只读预览、侧栏标记和一次性的分叉提示。

## 标识

| 类型 | 值 |
| --- | --- |
| 包名 | `@hmilyld/dsh-opencode-import` |
| Loader entry id / 设置命名空间 | `opencode-import` |
| bundle config key | `@hmilyld/dsh-opencode-import` |
| Host 短名 | `opencode-import` |
| Remote 命名空间 | `opencodeImport` |
| DSH 会话 id 前缀 | `session-oc-` |

## 环境要求

- Node `^22.19.0 || >=24.0.0`（以只读方式使用 `node:sqlite`）
- DSH `>=0.2.0-rc.2 <0.3.0`
- 使用当前 SQLite 结构（`session_v2` + `session_message`）的 OpenCode

## 安装

```bash
dsh plugin --profile web add @hmilyld/dsh-opencode-import
```

本地开发（先构建）：

```bash
pnpm --filter @hmilyld/dsh-opencode-import run build
dsh plugin --profile web add /absolute/path/to/DSHPlugins/packages/dsh-opencode-import
```

安装后重启一次 `dsh web`。

## 触发时机

- 插件加载后不久执行一次（**启动时扫描**）。
- 工作区注册表新增或变更时执行（**新增工作区时扫描**，带防抖）。
- 设置页点击**立即扫描**。

三种触发共用同一次进行中的扫描，不会重复写入。

## 导入范围

- OpenCode 的根会话（`parent_id` 为空）且未归档。
- 只导入 `directory` 规范化后等于某个已注册 DSH 工作区路径的会话；其余目录记为“未匹配”，不做处理。
- 设置了**单会话消息上限**时只保留最新的 N 条对话消息；`0` 表示全部导入。
- 用户文本、助手文本、推理（可选）、工具调用与结果（可选）、token 用量、OpenCode 标题。
- 用户附件会变成 `[附件: 名称]` 文本块，不搬运二进制。

默认跳过：子会话、归档会话、`synthetic` / `system` / `compaction` / `idle` 行，以及没有任何对话内容的会话。

## 写入过程

1. 由 OpenCode 会话 id 确定性派生 DSH 会话 id（`session-oc-<sha256[:24]>`），下一轮用只读 `stat` 就能识别“已导入”并跳过。
2. 对话映射为 `turn/start` → `step/start` → `user/message` / `assistant/message` / `tool/call` / `tool/result` → `step/end` → `turn/end`，末尾追加一条钉住的 `session/title` 事件（OpenCode 标题）。
3. 事件作为单个批次写入 DSH 会话日志，`cwd` 为工作区路径。
4. 用同一批事件预热投影缓存，侧栏在会话被打开之前就能显示标题和最近提示时间。
5. `workspace.attachSession()` 把会话挂到工作区，最新的排在最前。

任一步失败只影响该会话，并计入报告；整轮扫描继续。

## 配置

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `dbPath` | 空 | `opencode.db` 路径；留空探测 `$XDG_DATA_HOME/opencode/opencode.db`（Windows 为 `%LOCALAPPDATA%\opencode\opencode.db`） |
| `autoScanOnStart` | `true` | 插件加载后执行一次 |
| `scanOnWorkspaceCreate` | `true` | 工作区注册表变化时重新扫描 |
| `includeToolCalls` | `true` | 导入工具调用与结果 |
| `includeReasoning` | `true` | 导入助手推理块 |
| `maxMessagesPerSession` | `0` | 只保留最新 N 条对话消息；`0` 全部保留 |
| `excludedDirectories` | `[]` | 不导入其下会话的绝对路径 |

## 侧栏标题

侧栏标题来自投影缓存提示。DSH 用会话 header 身份（含 `cwd`）绑定缓存记录；目录迁移会改写 header，而缓存仍保留旧路径，`session/list` 就会丢弃这些会话的提示，行标题显示“未命名”，直到有人加载它们的投影。插件的侧栏标记会读取每个已渲染行的标题，缺失时向 Host 请求该会话的投影，这些行会自行补全，不需要逐个点开。

## 已知限制

- **单向快照**：每个 OpenCode 会话只导入一次，之后 OpenCode 新增的消息不会进入 DSH 副本。
- **继续会分叉**：导入的是真实 DSH 会话，可以继续对话；新内容只留在 DSH，OpenCode 侧看不到。会话视图会显示可关闭的提示。
- **会话格式耦合**：插件写入运行中存储实际使用的格式版本，并映射到当前 DSH 事件词汇。DSH 改变事件词汇时需要更新插件；不匹配只会让该会话失败并记录，不会静默写坏日志。
- **OpenCode 结构耦合**：只读当前 `session_v2` 结构；旧库报告 `unsupported`，不做猜测。
- **导入的是真实会话**：会参与 DSH 的搜索、统计等能力，无法设为只读。

## 开发

```bash
pnpm install
pnpm --filter @hmilyld/dsh-opencode-import run build
pnpm --filter @hmilyld/dsh-opencode-import run test
pnpm run check
```

映射是纯函数，测试会用真实的 `Session` 校验产出事件；`tests/importer.spec.ts` 覆盖规划、幂等与失败隔离；`tests/client.spec.ts` 覆盖 ModuleLoader 产物契约。

## License

MIT
