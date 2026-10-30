# @hmilyld/dsh-ocgo-usage-dock

## 0.4.0

### Minor Changes

- 5c2b80d: - 新增「显示占比横条」开关：关闭后隐藏每个用量窗口的横条，仅保留百分比数字。
  - 收紧内置性能与用量行和 OpenCode Go 用量行之间的间距，去掉多出的一行空白。
  - 刷新与设置按钮改用官方 SVG 图标并固定 18×18，修复移动端齿轮图标比刷新按钮大的问题。
  - 明确 composer dock 的注入顺序：官方先渲染 `conversation.composer.dock`、后渲染 `ContextMeter`，插件行仍用 `order` 排在视觉最后，不搬 DOM。

## 0.3.0

### Minor Changes

- 统一到 DSH 插件工程标准 v1。
  
  - 构建改为官方两段式：`tsc` → `tsdown` host（含 Typert 生成）→ `tsc` → `tsdown` client。
  - 发布产物改为 `lib/index.js` / `lib/client.js` / `lib/types/**`；`files` 白名单同步更新。
  - 设置页与更新提示改用私有 `@hmilyld/dsh-plugin-kit`；密钥仍走 `apiKeyEnv` + credentials + `SettingsCredentialField`。
  - 修复强制刷新在轮询在途时被吞掉的问题；secret 写入失败会保留草稿并标记失败。
  - 测试迁移到 `tests/` + vitest，覆盖 manifest、逻辑、Service 与客户端 bundle。

## 0.2.1

- 客户端自续轮询：用量条自动刷新，每轮重读当前刷新间隔，保存即生效。

## 0.2.0

- 首个公开版本：OpenCode Go 用量条（独立行 + 悬停重置时间）与插件页设置。
