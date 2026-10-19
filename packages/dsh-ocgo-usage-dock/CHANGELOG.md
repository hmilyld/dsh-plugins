# @hmilyld/dsh-ocgo-usage-dock

## 0.3.0

### Minor Changes

- 重构 Host 与 Client，并加入 npm 更新检测。
  
  - Host 改为 Typert Remote 服务：`@Remote` 生成 `lib/typert.host.*` / `lib/typert.remote-client.*`，客户端 `ctx.remote.$mount` 后通过 `remote.ocgoUsage` 取数。
  - 用量条改用 `conversation.input.dock`（输入框上方整行），移除 DOM portal 与手动设置导航。
  - 密钥改用 `apiKeyEnv` credential reference + credentials 服务 + `SettingsSecretField`；旧 `apiKey` 保留为 deprecated 兼容字段，并提供「清除旧版密钥」。
  - 缓存按当前 `refreshIntervalMs` 失效，并发请求 single-flight；移除固定 300 秒 TTL 与重复轮询。
  - 设置页改用官方 `SettingsForm` / `SettingsFormModel`，保存即热生效；新增中英文 locale。
  - 设置页顶部显示 npm 更新提示，用量条设置齿轮在发现新版本时显示绿点，并链接到本包 `CHANGELOG.md`。

### Patch Changes

- Updated dependencies
  - @hmilyld/dsh-plugin-updates@0.1.0

## 0.2.1

- 客户端自续轮询：用量条自动刷新，每轮重读当前刷新间隔，保存即生效。

## 0.2.0

- 首个公开版本：OpenCode Go 用量条（独立行 + 悬停重置时间）与插件页设置。
