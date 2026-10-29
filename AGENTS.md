# AGENTS.md

本仓库是 hmilyld 的 DSH 插件 monorepo。改动前先读 [`docs/plugin-standard.md`](./docs/plugin-standard.md) 与 [`docs/known-deviations.md`](./docs/known-deviations.md)；发布测试清单见 [`docs/release-testing.md`](./docs/release-testing.md)。

## 命令

```bash
pnpm install
pnpm run build
pnpm run typecheck   # 需要先 build
pnpm run lint
pnpm run test
pnpm run check       # build + lint + test
pnpm run pack:check  # publint
```

单包：

```bash
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run test
```

## 结构

- `packages/dsh-beacon`：事件监听 + webhook 插件。
- `packages/dsh-ocgo-usage-dock`：Typert Remote + credentials + dock 的完整参考。
- `packages/dsh-opencode-import`：只读扫描 OpenCode SQLite，把会话导入为真实 DSH 会话。
- `packages/dsh-plugin-kit`：private 设置/更新 Kit，打包进插件，不发 npm。
- `tooling/tsdown.preset.mjs`：共享 tsdown 配置（host ESM / client CJS ModuleLoader）。
- `tooling/build/build-package.mjs`：单包两段式构建（tsc → tsdown host → tsc → tsdown client）。
- `tooling/scaffold`：`pnpm gen:plugin` 模板。

## 不能破坏的约束

- 不改已发布包名与 `cordis.patch.yml` 的 `id`；设置命名空间等于 entry id。
- 新插件 entry id 默认取包名去掉 `@hmilyld/dsh-`；`dsh-beacon` 是历史例外。
- 不把 `lib/` 提交进 git；发布由 `files` 白名单带产物。
- 不手写 Typert wire descriptor；用 `@Remote` + 官方 `typertPlugin`。
- 不在客户端直接读写 settings 文档；用 `@hmilyld/dsh-plugin-kit` 的 staged form。
- 不把 secret 写进 settings；用 `apiKeyEnv` + `ctx.credentials` / `SettingsCredentialField`。
- 不在客户端直接操作 DOM 或做设置页导航；用官方 slot 与 `ctx.pluginNavigation`。
- `remote.<namespace>` 必须用 `ctx.inject([...])` 等待 `$mount` 之后的服务；顶层 `inject` 只能写 `remote`。
- 每个插件设置页必须用 Kit 展示更新提示；版本取 `__PKG_VERSION__`，链接到本包 `CHANGELOG.md`。
- 每个用户可见改动都要有 changeset；`CHANGELOG.md` 必须进 `files`。

## 常见的坑

- Typert 生成器只认工作区内的 `@deepseek-ai/dsh-typert-protocol` 声明。仓库根 `typert-protocol.d.ts` 是唯一 ambient shim；Typert 插件在 `src/index.ts` 用 `/// <reference path="../../../typert-protocol.d.ts" />` 引入，不要在包内复制副本（重复声明会让生成器把第二个包判成跨包引用）。
- 官方 `dsh-client-ui-slots` 的 d.ts 引用 `dsh-client-store`，但后者不在其依赖里；客户端包必须自己把 `@deepseek-ai/dsh-client-store` 放进 devDependencies。
- Schemastery 的 `Config` 不要写 `: Schema<Config>` 显式注解。
- `tsc -b` 在删除 `lib/` 后仍可能认为输出是最新的；`build-package.mjs` 使用 `--force`。
- vitest 不能直接 transform 标准装饰器；Service 测试导入 `lib/index.js`，不要导入 `src/index.ts`。
- `lib/client.js` 是 CJS 的 ModuleLoader 产物，publint 会提示应按 `.cjs` 解释；这是浏览器加载器契约，不是 Node ESM，保留警告。
- 本地 `dsh plugin add <path>` 安装的是软链，包目录里必须已有 `pnpm install` 后的 `node_modules` 与构建好的 `lib/`。
