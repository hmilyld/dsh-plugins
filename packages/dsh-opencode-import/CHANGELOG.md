# @hmilyld/dsh-opencode-import

## 0.1.1

### Patch Changes

- 修复 0.1.0 无法安装的问题：该版本用 `npm publish` 发布，`catalog:` 与 `workspace:*`
  协议未被解析，安装时报 `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`。0.1.1 用
  `pnpm publish` 重新发布，依赖已解析为具体版本范围。
- 新增 `prepublishOnly` 客户端校验（`tooling/build/verify-publish-client.mjs`）：
  用 npm 发布时直接失败，避免再次产出未解析协议的包。

## 0.1.0

### Minor Changes

- 首个版本：把工作区的 OpenCode 会话导入 DSH 会话列表。

  - Host 侧只读打开 OpenCode SQLite（`session_v2`），按 `directory` 匹配已注册工作区，把根会话映射为 DSH 会话事件并以确定性 id（`session-oc-<sha256[:24]>`）写入真实会话日志。
  - 预热 `sessionProjectionCache`，侧栏无需打开会话即可显示 OpenCode 标题与最近活动时间；通过 `workspace.attachSession` 挂到对应工作区。
  - 启动、工作区变更、设置页“立即扫描”三种触发共用一次进行中的扫描；已导入的会话按 header `stat` 跳过。
  - 新增工作区后客户端自动重拉会话目录（工作区模型订阅 + 导入计数兜底），无需刷新页面。
  - 设置页提供数据库路径、启动/工作区扫描开关、工具调用与推理开关、单会话消息上限、排除目录，以及只读扫描预览。
  - 侧栏导入标记与会话内“继续会与 OpenCode 分叉”提示。

  > 该版本已从 npm 撤销说明（deprecated）：依赖协议未解析，无法安装。请使用 0.1.1 及以上。
