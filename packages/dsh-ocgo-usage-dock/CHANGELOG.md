# @hmilyld/dsh-ocgo-usage-dock

## 0.3.0

- 重构进 `@hmilyld/dsh-plugins` monorepo，构建、类型检查与发布流程与 `@hmilyld/dsh-beacon` 统一。
- Host 改为 Typert Remote 服务：`@Remote` 生成 `lib/typert.host.*` / `lib/typert.remote-client.*`，客户端 `ctx.remote.$mount` 后通过 `remote.ocgoUsage` 取数，不再手写 wire descriptor。
- 用量条改用 `conversation.input.dock`（输入框上方整行），移除 DOM portal 与手动设置导航。
- 密钥改用 `apiKeyEnv` credential reference + credentials 服务 + `SettingsSecretField`；旧 `apiKey` 保留为 deprecated 兼容字段，并在设置页提供「清除旧版密钥」。
- 缓存按当前 `refreshIntervalMs` 失效，并发请求 single-flight；移除固定的 300 秒 TTL 与重复轮询。
- 设置页改用官方 `SettingsForm` / `SettingsFormModel`，保存即热生效。
- 新增中英文 locale、完整 smoke test 与本地构建工具链。
- 包名 `@hmilyld/dsh-ocgo-usage-dock` 与 Loader entry id `ocgo-usage-dock` 保持不变，已有 profile 配置继续可用。

## 0.2.1

- 客户端自续轮询：用量条自动刷新，每轮重读当前刷新间隔，保存即生效。

## 0.2.0

- 首个公开版本：OpenCode Go 用量条（独立行 + 悬停重置时间）与插件页设置。
