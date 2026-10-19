# @hmilyld/dsh-ocgo-usage-dock

DSH（DeepSeek Harness）Web 插件：在 **输入框上方整行** 显示 OpenCode Go 的 5 小时滚动、本周、本月用量，并在插件页提供配置。数据由 Host 侧的 Typert Remote 提供，密钥存放在 DSH 的 credentials 里，不写进 settings 文件。

```text
OpenCode Go 用量   5 小时 ▓▓▓░░ 29%   本周 ▓▓▓▓░ 84%   本月 ▓▓░░░ 46%   ⟳  ⚙
[输入框]
```

- 鼠标悬停任一窗口可看重置时间。
- 颜色健康度：< 60% 绿、60–85% 黄、≥ 85% 红。
- 未配置密钥时整行**不渲染**；接口失败时显示错误与重试按钮，不会打断对话。
- 用量请求只读 OpenCode Go 的元数据接口，不消耗模型 token。
- 插件页设置保存后即时生效；刷新间隔、超时、接口地址都可改。

## 环境

- Node `^22.19.0 || >=24.0.0`
- DSH `>=0.2.0-rc.2 <0.3.0`
- pnpm `12.5.1`（仅从源码构建时需要）

## 安装

### 从 npm（推荐）

```bash
dsh plugin --profile web add @hmilyld/dsh-ocgo-usage-dock
```

### 从本仓库本地安装

先构建，再把包目录的绝对路径交给 DSH：

```bash
pnpm install
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
dsh plugin --profile web add /absolute/path/to/DSHPlugins/packages/dsh-ocgo-usage-dock
```

装完重启一次 `dsh web`。卸载：

```bash
dsh plugin --profile web remove @hmilyld/dsh-ocgo-usage-dock
```

## 配置

打开 **插件 → @hmilyld/dsh-ocgo-usage-dock**。

| 字段 | 说明 |
| --- | --- |
| 凭证引用 | 保存密钥的环境变量/credential 名称，默认 `OPENCODE_GO_API_KEY`。Host 每次请求都会重新解析。 |
| API Key | 写入 DSH credentials 的密钥，不进入 settings 文件。留空表示保持当前密钥。 |
| 刷新间隔（秒） | 用量条的取数频率，最小 10 秒，默认 300 秒。 |
| 请求超时（秒） | 单次请求上限，最小 1 秒，默认 15 秒。 |
| 用量接口地址 | 默认 `https://opencode.ai/zen/go/v1/usage`，一般不用改。 |

### 密钥解析顺序

Host 按以下顺序取第一个非空值：

1. 旧版 `apiKey` 配置（deprecated，仅为兼容已保存的 profile）；
2. `process.env[apiKeyEnv]`；
3. 历史环境变量 `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY`；
4. DSH credentials 中 `apiKeyEnv` 对应的值。

如果设置页出现「当前配置仍在使用已弃用的 apiKey 字段」，说明第 1 步仍然命中。先把密钥写入上面的 **API Key** 字段并保存，再点 **清除旧版密钥**，之后就会使用 credentials。

## 更新检测

插件客户端会通过 `@hmilyld/dsh-plugin-updates` 查询 npm 上本包的 `latest` 版本（6 小时缓存，失败静默）。发现新版本时：

- 设置页顶部显示「发现新版本 vX.Y.Z（当前 vA.B.C）」和 **查看更新说明** 链接；
- 用量条右侧的设置齿轮出现一个绿色小点。

更新说明来自本包的 [`CHANGELOG.md`](./CHANGELOG.md)，每次发布由 Changesets 生成。

## 常见问题

**用量条显示 401**

OpenCode Go 返回的是 `api_key_expired` 或类似认证错误，说明当前密钥已过期或没有权限。到 OpenCode Console 重新生成密钥，在设置页的 **API Key** 写入并保存，或更新对应的环境变量。

**用量条完全不显示**

- 没配置可用密钥时这是预期行为（静默隐藏）。
- 确认插件在 **插件 → 包含的组件** 里是「运行中」。
- 打开浏览器开发者工具，确认 `POST /api/ocgoUsage/snapshot` 返回 200；如果 404/500，检查 `lib/typert.host.js` 是否随包发布。

**修改设置后不生效**

设置页需要点 **保存**。保存后 Host 会清掉旧缓存并在下一次请求使用新值；用量条也可能在下一次轮询才更新。

## 实现

- **Host**：`src/index.ts` 默认导出一个 `TypertRemoteService`，提供 `ocgoUsage/snapshot`。`src/usage.ts` 负责配置展开、密钥解析、响应归一化、超时/网络错误折叠；缓存按当前刷新间隔失效，并发请求 single-flight。
- **Client**：`src/client/index.tsx` 先 `ctx.remote.$mount(./remote)`，再用 `ctx.inject(['remote.ocgoUsage', ...])` 等命名空间就绪；一个 controller 统一管理设置表单、credentials 状态和唯一一条轮询。`UsageDock` 注册到 `conversation.input.dock`，`SettingsCard` 注册到 `plugins.bundle.config`。
- **生成**：`@Remote` 方法由官方 Typert 生成器产出 `lib/typert.host.*` 与 `lib/typert.remote-client.*`，客户端 bundle 直接包含生成的 Remote 与 zod schema。

## 开发

```bash
pnpm install
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run typecheck
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run test
```

构建顺序（package script 已串好）：Host `tsc` → Typert 生成 → Client `tsc` → esbuild bundle。

## License

MIT
