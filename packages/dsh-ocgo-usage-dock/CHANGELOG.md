# @hmilyld/dsh-ocgo-usage-dock

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
