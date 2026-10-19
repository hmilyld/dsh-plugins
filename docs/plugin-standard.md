# DSH 插件标准（本仓库）

以 DSH `0.2.0-rc.2` 的官方包与文档为基准。`dsh-beacon` 是较简单的参考实现，`dsh-ocgo-usage-dock` 是包含 Typert Remote + credentials + 多 slot 的完整参考。

## 1. 包与入口

- 包名：`@hmilyld/dsh-*`，放在 `packages/<pkg>`。
- `type: "module"`，Host 入口 `lib/types/index.js`（或简单包 `lib/index.js`），Client 入口 `lib/client.js`。
- `cordis.patch.yml` 的 `id` 是 Loader entry id，也是设置命名空间。**一旦发布不要改**；`name` 必须等于 `package.json.name`。
- `exports` 至少包含 `.`、`./client`、`./package.json`；使用 Typert 时再加 `./types`、`./typert`、`./remote`。
- `files` 用白名单。Typert 包必须显式列出 `lib/typert.host.js`、`lib/typert.host.d.ts`、`lib/typert.remote-client.js`、`lib/typert.remote-client.d.ts`，生成器会校验这四个字符串。
- `engines.dsh` 与 peer 范围至少覆盖当前开发版本；共享的 `@deepseek-ai/*` 放 `peerDependencies` + `devDependencies`，纯函数工具（schemastery、zod、cosmokit）放 `dependencies`。

## 2. Host

- 简单插件导出 `name` / `inject` / `Config` / `apply(ctx, config)`，或默认导出一个 Cordis 插件类。
- 需要给浏览器提供数据时，用 Typert Remote：

```ts
export default class UsageController extends TypertRemoteService {
  static inject = ['typert']
  static Config = Config
  constructor(ctx: Context, config: Config) {
    super(ctx, 'ocgoUsage', { namespace: 'ocgoUsage' })
    this.config = config
  }
  @Remote
  async snapshot(force: boolean): Promise<UsageSnapshot> { ... }
}
```

- `@Remote` 方法的参数与返回值必须能被 Typert 表示：JSON 标量、数组、对象、可选字段、字符串字面量联合。不要用 `Date`、class、函数、`Map`。
- 一个包只提供一个 Remote namespace 时，`serviceKey` 与 `namespace` 用同一个 camelCase 名字。
- Host 侧不要自己做轮询推送；让 Client 通过 Remote 拉取，Host 负责缓存与 single-flight。缓存 TTL 从当前配置读取，不要写死。
- 网络失败要折叠成值（如 `{ status: 'error', error: 'timeout' }`），不要 throw 到 Remote 层，客户端才能稳定渲染。
- 读 volatile 配置必须每次 `.get()`，不能缓存 apply 时的值。

### Typert 生成

本仓库不直接依赖官方 workspace 的协议源码，因此 `packages/<pkg>/src/typert-protocol.d.ts` 提供 `@deepseek-ai/dsh-typert-protocol` 的 ambient module 声明，让生成器能识别 `@Remote` / `TypertRemoteService`。`tsconfig.json` 用 `paths` 只把这个 specifier 指向该声明；编译产物仍然 import 真实包。

构建顺序必须是：

1. `tsc -b tsconfig.json` → `lib/types`
2. `node ../../tooling/build/generate-typert.mjs ../.. <packageName>` → `lib/typert.host.*`、`lib/typert.remote-client.*`
3. `tsc -b tsconfig.client.json`（客户端类型检查会读第 2 步的 `.d.ts`）
4. `node ../../tooling/build/build-client.mjs .` → `lib/client.js`

## 3. 配置与密钥

- 导出与插件同名的 Schemastery `Config`，默认值写在 schema 字段上。
- 可编辑字段加 `.volatile()`，类型写成 `Volatile<T>`；Host 读取时用 `isVolatile(value) ? value.get() : value`。
- 密钥字段：
  - 新配置：`apiKeyEnv`（credential reference，例如 `OPENCODE_GO_API_KEY`）。
  - 旧配置兼容：`apiKey` 保留为 `role('secret')` 的 deprecated 字段，Host 读取时仍可用。
  - 客户端不要渲染旧 `apiKey` 的明文；需要迁移提示时，用 Remote snapshot 里的 `legacyApiKey` 布尔值，并通过表单的 `resetField('apiKey')` 清除。
- 客户端写密钥必须走 `ctx.remote.credentials.set(ref, value)`，并 `describe([ref])` 显示是否已配置。不要新增自己的密钥存储。
- Host 解析顺序建议：旧 `apiKey` → `process.env[apiKeyEnv]` → 历史 env 名 → `ctx.credentials.resolve(ref)`。这样旧 profile 不改也能工作，新配置又能热更新。

## 4. Client

- 客户端只导出 `inject` 与 `apply`；`apply` 返回 disposer。
- 需要 Typert Remote 时：

```ts
export const inject = ['remote']

export async function apply(ctx: Context) {
  const disposeRemote = await ctx.remote.$mount(remoteContribution)
  const ui = ctx.inject(
    ['remote.ocgoUsage', 'remote.credentials', 'slots', 'locale', 'configForms', 'pluginNavigation'],
    (scoped) => { mountUi(scoped) },
  )
  await ui
  return async () => { await ui.dispose(); await disposeRemote() }
}
```

`remote.<namespace>` 是 `$mount` 之后才出现的服务，必须用 `ctx.inject([...])` 等它；不要把它写进顶层 `inject`，否则插件永远不激活。

- Slot：
  - 设置卡片：`plugins.bundle.config`，key 是 bundle 包名。
  - 输入框上方整行：`conversation.input.dock`。
  - 输入框下方居中行：`conversation.composer.dock`（与 DSH 自带 token 用量共享，不要挤占）。
  - 注册前用 `ctx.configForms.whileServed([ENTRY_ID], ...)` 确认 Host 正在提供该命名空间。
- 表单统一用 `SettingsFormModel` + `SettingsForm` + `SettingsValueField` / `SettingsSecretField`。所有写入只发生在 `save()`；不要做“输入即保存”。
- 文案放 `locales.ts`，声明 `LocaleNamespaceMap`，注册 `ctx.locale.register(NS, { zh, en })`；slot 注册写 `locale: NS`，组件从 props 拿 `t`。
- 不要 DOM portal、不要 querySelector、不要自己做设置页跳转；用 `ctx.pluginNavigation.openBundle(PKG_NAME)`。
- 客户端 bundle 只 external `react` / `react-dom` / `@deepseek-ai/*`。生成的 Remote 与 `zod` 要打进 bundle。

## 5. 更新检测与升级说明

- **每个插件**（包括后续新增）都必须在设置页展示更新提示。统一使用 `@hmilyld/dsh-plugin-updates`：

```ts
import { createUpdateStore, UpdateNotice } from '@hmilyld/dsh-plugin-updates'

const updates = createUpdateStore({
  packageName: '@hmilyld/dsh-my-plugin',
  currentVersion: __PKG_VERSION__, // build-client.mjs 从 package.json 注入，不要手写
})
void updates.refresh(false)
```

把 store 放进 slot 的 `hooks`（`hooks: { update: updates }`），组件用 `props.useUpdate((s) => s)` 读取并渲染：

```tsx
<UpdateNotice
  state={props.useUpdate((s) => s)}
  changelogUrl="https://github.com/hmilyld/dsh-plugins/blob/main/packages/dsh-my-plugin/CHANGELOG.md"
  labels={{ available: '发现新版本 v{latest}（当前 v{current}）。', changelog: '查看更新说明' }}
/>
```

- 新插件必须把 `@hmilyld/dsh-plugin-updates` 加进 `dependencies`（`workspace:^`）。
- 更新检查在浏览器侧查询 npm registry 的 `latest`，带 6 小时缓存与静默失败；不要改为在 Host 侧轮询。
- 所有包统一从本仓库发布到 npm。**每个用户可见改动都必须写 changeset**（`pnpm changeset`），`pnpm run version-packages` 会生成/追加各包 `CHANGELOG.md`；`CHANGELOG.md` 必须在 `files` 白名单里，随包发布。
- 升级说明链接固定指向仓库内的 `packages/<pkg>/CHANGELOG.md`；发布前确认该版本有对应小节。
- 现有插件：`dsh-beacon` 在设置卡片顶部展示，`dsh-ocgo-usage-dock` 在设置卡片顶部展示并在用量条的设置齿轮上点一个小绿点。

## 6. 测试

每个包至少覆盖：

- `package.json` 的 exports / files / dsh 声明 / engines。
- `cordis.patch.yml` 的 id、name、默认配置与 package.json 一致。
- 配置默认值与范围夹取。
- Host 纯逻辑：响应归一化、密钥优先级、超时/HTTP/网络错误折叠。
- 真实 Service 实例：`remoteMethods()` 能看到 `@Remote` 方法，缓存/single-flight 行为正确。
- 生成产物存在且包含 endpoint。
- 客户端 bundle 能被 `window.__ModuleLoader__.load` 接收，`factory(require)` 只请求预期模块，导出 `apply` / `inject`。

UI 改动建议用真实 `dsh web` 做一次集成检查：插件页能看到卡片、设置能保存、dock 出现在正确 slot。

## 7. 发布

- 使用 Changesets，包独立版本；所有包统一从本仓库发布到 npm。
- 任何用户可见改动先 `pnpm changeset`，说明会用作用户可读的升级说明；`pnpm run version-packages` 生成各包 `CHANGELOG.md`。
- 版本号与 changelog 由 Changesets 维护，不要手改 `version` 或直接编辑历史小节。
- 发布前 `pnpm run check`。
- `prepublishOnly` 跑 typecheck + test；`prepare` 供本地/源码安装构建。
- 不改包名与 entry id；需要重命名时先提供兼容 entry 与迁移说明。
- npm Trusted Publisher 绑定本仓库与 `.github/workflows/release.yml`。
