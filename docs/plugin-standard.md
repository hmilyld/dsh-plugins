# DSH 插件工程标准 v1

本文件是本仓库的唯一工程标准。所有插件（含存量与新增）必须遵守；脚手架产物即按本标准生成。

基准：DSH `0.2.0-rc.2`。能对齐官方 `deepseek-ai/deepseek-harness` 的地方一律对齐；无法对齐的偏差记录在 [`known-deviations.md`](./known-deviations.md)。

## 0. 原则

1. 官方优先：目录、产物、命名、测试、构建尽量与官方一致。
2. 一套标准：不允许某个包特殊；共享能力下沉 `@hmilyld/dsh-plugin-kit`。
3. 清晰优先：目录清晰、单文件单职责；注释只写 why（约束、原因、坑），不写 what。
4. 行为冻结：重构不得改变插件既有业务行为（beacon 的触发/去重逻辑、ocgo 的用量语义）。

## 1. 目录结构

```
packages/dsh-<name>/
  package.json  cordis.patch.yml  LICENSE
  tsconfig.json  tsconfig.client.json  tsdown.config.ts
  README.md  README.zh.md  CHANGELOG.md
  src/
    index.ts              # Host 入口，只做接线
    config.ts             # Schemastery Config + Config 类型
    types.ts              # 跨半边 wire 类型
    logic.ts              # 纯逻辑，无 cordis 依赖
    constants.ts          # 默认值/常量
    typert-protocol.d.ts  # 仅 Typert 插件；从 Kit 复制/引用
    client/
      index.tsx           # apply/inject、mount remote、注册 slot
      controller.ts       # 表单 + stores + 轮询
      settings.tsx        # 设置卡片（只用 Kit）
      locales.ts          # zh/en 字典 + LocaleNamespaceMap
      globals.d.ts        # __PKG_VERSION__ / __PKG_CHANGELOG_URL__
  tests/
    <subject>.spec.ts
    <subject>.client.spec.tsx
  examples/               # 可选
```

禁止：`scripts/` 目录、包级 `AGENTS.md`、包级 `.github/`、包级 `.gitignore`。

## 2. 命名与标识

| 名称 | 规则 | 示例 |
| --- | --- | --- |
| 包名 | `@hmilyld/dsh-<kebab>` | `@hmilyld/dsh-beacon` |
| entry id / 设置命名空间 | 默认 = 包名去掉 `@hmilyld/dsh-`；允许更短语义名；发布后冻结 | `ocgo-usage-dock`、`beacon` |
| bundle config key | 包名 | `@hmilyld/dsh-beacon` |
| Host 短名 | 等于 entry id | `ocgo-usage-dock` |
| Remote service/namespace | camelCase，二者同名 | `ocgoUsage` |
| 组件 | PascalCase `.tsx` | `SettingsCard.tsx` |
| 逻辑 | 小写 `.ts` | `controller.ts` |
| 测试 | `<subject>.spec.ts` / `<subject>.client.spec.tsx` | `logic.spec.ts` |

存量例外：`@hmilyld/dsh-beacon` 的 entry id 固定为 `dsh-beacon`，不得改。新插件不得再采用这种写法。每个插件 README 必须登记「包名 ↔ entry id ↔ bundle key ↔ 短名」。

## 3. 构建与产物

### 3.1 两段式

```
tsc -b tsconfig.json                 → lib/types
DSH_BUILD_FACE=host tsdown           → lib/index.js + lib/typert.*
tsc -b tsconfig.client.json          → lib/types/client
DSH_BUILD_FACE=client tsdown         → lib/client.js
```

包脚本统一为 `node ../../tooling/build/build-package.mjs .`，由该脚本按顺序执行上述四步，并根据包是否存在 client 半边决定是否跑后两步。

### 3.2 产物布局（对齐官方）

- Host：`main: lib/index.js`，`types: lib/types/index.d.ts`。
- Client：`exports["./client"].default: ./lib/client.js`，`types: ./lib/types/client/index.d.ts`。
- Typert：`./typert` → `lib/typert.host.{js,d.ts}`；`./remote` → `lib/typert.remote-client.{js,d.ts}`；`./types` → `lib/types/types.{js,d.ts}`。
- `files` 白名单：
  - 所有包：`lib/index.js`、`lib/types/**/*.d.ts`、`cordis.patch.yml`、`CHANGELOG.md`。
  - 有 client：`lib/client.js`。
  - 有 `./types` 导出：`lib/types/**/*.js`。
  - Typert 四件套必须逐项列出。
  - 不含 `.map`、`*.tsbuildinfo`、源码。
- `lib/` 不提交 git；CI 检查 `packages/*/lib/**` 未被跟踪。

### 3.3 bundle 契约

- Client：CJS，`window.__ModuleLoader__.load({ id, factory })`；输入是 tsc 产物 `lib/types/client/index.js`；external = `dsh.client.inject` + `dsh.client.external` + `react`（含子路径）；其余内联。未声明的 `@deepseek-ai/*` value import 必须构建失败；type-only import 不受影响。
- Host：ESM；external = `dependencies` + `peerDependencies`；其余内联。
- 生成 sourcemap，但不发布。

### 3.4 Typert 偏差

协议来自 npm，不在 workspace 内。Kit 提供规范的 `typert-protocol.d.ts` ambient shim；Typert 插件把它**复制到自己的 `src/typert-protocol.d.ts`**，并用 `tsconfig.json` 的 `paths` 指向本包副本（生成器按包根解析，直接引用 Kit 路径会失效）。构建仍使用官方 `typertPlugin`（package 模式），产物 import 真实协议包。

## 4. package.json

- 必填：`name`、`version`、`description`、`type: module`、`main`、`types`、`exports`、`files`、`dsh`、`scripts`、`engines`、`publishConfig.access: public`、`license`、`author`、`repository`（含 `directory`）、`homepage`、`bugs`、`keywords`。
- `exports` 至少 `.`、`./src/*`、`./package.json`；有 client 加 `./client`；有 Typert 加 `./types`、`./typert`、`./remote`。
- `scripts`：`build`（build-package）、`typecheck`、`test`（vitest run）、`prepublishOnly`（build + test）。禁止 `prepare`。
- `engines`：`node: "^22.19.0 || >=24.0.0"`，`dsh: ">=0.2.0-rc.2 <0.3.0"`。
- `cordis.patch.yml` 只写 `id`、`name` 与必填/安全/非默认字段，不复制 schema 默认值。

依赖放置：

| 类别 | 放置 |
| --- | --- |
| Host 共享服务 | `peerDependencies` + `devDependencies` |
| Client 模块（模块表） | 仅 `devDependencies` |
| 纯工具 / wire 依赖 | `dependencies` |
| 内部 Kit | 仅 `devDependencies`（`workspace:*`，打包进产物） |

## 5. Host

- 入口：默认导出 Cordis 插件类；有 Remote 时继承 `TypertRemoteService`。简单插件允许命名导出 `name`/`inject`/`Config`/`apply`。
- 分层：`index.ts` 接线；业务纯函数进 `logic.ts`；配置进 `config.ts`；wire 类型进 `types.ts`。
- Config：可编辑字段全部 `.volatile()`；默认值写 schema；旧密钥 `role('secret')` 兼容；不要写 `: Schema<Config>` 注解。
- Remote：
  - 参数/返回值必须 Typert 可表示；状态字段用字符串字面量联合。
  - 网络失败折叠为值，不 throw。
  - 缓存 TTL 读当前配置；并发 single-flight；**强制刷新不得被在途请求吞掉**。
- 密钥顺序：旧 `apiKey` → `process.env[apiKeyEnv]` → 历史 env 名 → `ctx.credentials.resolve`。secret 永不进 settings。
- `role('secret')` 字段不出现在 settings 的 `user` 层，`resetField` 因 `stored === false` 不会产生 unset；清除旧 `apiKey` 必须直接 `scope.mutate([{ op: 'unset', path: ['apiKey'] }], revision)`。
- 网络：除更新检测外，所有外部请求走 Host；必须有超时；失败只记日志。
- 日志：`ctx.logger(<entry-id>)`；禁止 `inject: ['logger']`；禁止打印 secret/Authorization/完整 payload。
- 生命周期：定时器 `ctx.effect` 清理；Map/Set 有硬上限。

## 6. Client

- 只导出 `inject` 与 `apply`；`apply` 返回 disposer。
- Typert：`await ctx.remote.$mount(remote)` 后，用 `ctx.inject(['remote.<ns>', ...], mountUi)`；不得把 `remote.<ns>` 写进顶层 `inject`。
- Slot：
  - 设置卡片：`plugins.bundle.config`，key = 包名。
  - 输入框上方整行：`conversation.input.dock`。
  - 输入框下方居中：`conversation.composer.dock`（与官方 token 行共享）。
  - 一律先 `ctx.configForms.whileServed([ENTRY_ID], ...)`。
- 一个客户端插件一个 controller，统一持有表单、credentials 状态、更新 store、唯一轮询。
- 禁止 DOM portal / querySelector / 手写设置导航；用 `ctx.pluginNavigation.openBundle(PKG_NAME)`。
- 构建注入：`__PKG_VERSION__`、`__PKG_CHANGELOG_URL__`。

## 7. 设置界面

统一使用 `@hmilyld/dsh-plugin-kit/settings`（内部 private 包，打包进插件）：

| 需要 | 组件 |
| --- | --- |
| 表单外壳 | `PluginSettingsForm`（包装官方 `SettingsForm`，自动带更新提示） |
| 单行文本 | 官方 `SettingsValueField` |
| 多行/JSON | `SettingsTextareaField` |
| 数字/秒 | `SettingsNumberField` / `SettingsSecondsField` |
| 布尔 | `SettingsToggleField` |
| 密钥 | `SettingsCredentialField`（`apiKeyEnv` + 官方 `SettingsSecretField` + legacy 提示） |

- 固定顺序：更新提示 → 必填 → 可选/高级 → 迁移提示 → 保存。
- 所有写入只在 `save()`；密钥写入必须检查 `credentials.set` 的 `result.ok`，失败保留草稿并提示。
- 只读部署整体 disabled；非法字段阻止保存。
- 可访问性：`label htmlFor`、`aria-invalid`、`aria-describedby`；开关与 label 关联。
- 禁止插件内自定义 field/labels/内联样式；业务专用控件必须使用官方 primitives 与 `--dsw-*` 令牌，并在评审中说明。

## 8. i18n

- 每个插件必须有 `src/client/locales.ts`：`LocaleKey` 字面量联合 + `en`/`zh` 完整 `Record` + `LocaleNamespaceMap` 增强。
- 命名空间 `settings.<entry-id>`；通用键由 Kit 提供，插件只补业务键。
- 禁止用户可见硬编码字符串；缺任一语言测试失败。
- `README.md` 英文、`README.zh.md` 中文，顶部语言切换。

## 9. 测试

- `tests/` + vitest；Host `<subject>.spec.ts`，Client `<subject>.client.spec.tsx`；jsdom 仅用于组件。
- 必测：
  1. manifest：exports/files/dsh/engines/patch id+name；
  2. 生成产物存在且含 endpoint；
  3. `logic.ts` 纯逻辑；
  4. Service：`remoteMethods`、缓存 TTL、single-flight、强制刷新；
  5. client bundle 契约：ModuleLoader、external 集合、apply/inject；
  6. 更新检测：版本比较、缓存、404、陈旧缓存；
  7. 设置卡片：渲染、保存、错误、secret 写入失败。
- 发版前手工集成：真实 `dsh web` 中设置页、dock、更新提示。

## 10. 文档与发布

- `README.md`（英）+ `README.zh.md`（中），含安装、配置、密钥、更新检测、常见问题、开发命令。
- `CHANGELOG.md` 由 Changesets 生成，中文说明；必须进 `files`。
- 所有包从本仓库统一发 npm；独立版本；单根 `.github/workflows/release.yml`。
- 每个用户可见改动必须有 changeset；发布 workflow 只走 OIDC（不设 `registry-url` / `NODE_AUTH_TOKEN`），首次发布时实测；失败再回退 token。
- 更新提示链接 `https://github.com/hmilyld/dsh-plugins/blob/main/packages/<pkg>/CHANGELOG.md`。

## 11. 质量闸门

- 根脚本：`build`、`typecheck`、`lint`、`test`、`check`（build + lint + test）、`pack:check`。
- Lint：`oxlint` + `oxlint-tsgolint`，根 `.oxlintrc.json`。
- CI：Node 22/24 矩阵；`pnpm install --frozen-lockfile` → `pnpm check` → `publint`；检查嵌套 workflow、`lib/` 未跟踪。
- 依赖升级：DSH catalog 精确钉住；升级单独 changeset + 全量 check + 真实集成。

## 12. Definition of Done

- [ ] 目录/命名符合 §1/§2
- [ ] package.json/依赖/patch 符合 §4
- [ ] 产物为 `lib/index.js` + `lib/client.js` + `lib/types/**`，`files` 正确
- [ ] Host 分层、Config 全 volatile、密钥走 credentials
- [ ] Client scoped inject、Kit 设置表单、zh/en、更新提示
- [ ] `tests/` 必测清单覆盖，`pnpm test` 绿
- [ ] README 双语 + CHANGELOG + LICENSE
- [ ] 根 tsconfig references 已加；`pnpm check` 绿
- [ ] `pnpm pack` + publint 通过
- [ ] 有 changeset

## 13. 新增插件

```
pnpm gen:plugin dsh-foo
```

脚手架生成 §1 全套文件，并自动加入根 tsconfig references；生成后 `pnpm check` 应直接绿。
