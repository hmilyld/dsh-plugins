# AGENTS.md

本仓库是 hmilyld 的 DSH 插件 monorepo。改动前先读 `docs/plugin-standard.md`。

## 命令

```bash
pnpm install
pnpm run build
pnpm run typecheck   # 需要先 build（客户端类型依赖生成的 ./remote）
pnpm run test
pnpm run check       # build + test
```

单包：

```bash
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run test
```

## 结构

- `packages/dsh-beacon`：无 Typert Remote 的简单 Host + Client 插件参考。
- `packages/dsh-ocgo-usage-dock`：Typert Remote + credentials + 两个 slot 的完整参考。
- `tooling/build/build-client.mjs`：共享 esbuild 客户端打包器（ModuleLoader 包装）。
- `tooling/build/generate-typert.mjs`：调用官方 Typert 生成器，输出 `lib/typert.*`。
- `tsconfig.host.json` / `tsconfig.client.json`：根聚合，生成器靠它们发现 `packages/*`。

## 不能破坏的约束

- 不改已发布包名与 `cordis.patch.yml` 的 `id`；设置命名空间等于 entry id。
- 不把 `lib/` 提交进 git；发布由 `files` 白名单带构建产物。
- 不手写 Typert wire descriptor；用 `@Remote` 生成。
- 不在客户端直接读写 settings 文档；用 `SettingsFormModel` 的 staged form。
- 不把 secret 写进 settings；用 `apiKeyEnv` + `ctx.credentials` / `SettingsSecretField`。
- 不在客户端直接操作 DOM 或做设置页导航；用官方 slot 与 `ctx.pluginNavigation`。
- `remote.<namespace>` 必须用 `ctx.inject([...])` 等待 `$mount` 之后的服务；顶层 `inject` 只能写 `remote`。

## 常见的坑

- Typert 生成器只认工作区内的 `@deepseek-ai/dsh-typert-protocol` 声明。我们通过 `src/typert-protocol.d.ts` + `tsconfig.json` 的 `paths` 提供 ambient shim；删掉它生成器会报 “has no Remote methods”。
- `@deepseek-ai/dsh-client-ui-slots` 的声明文件引用 `@deepseek-ai/dsh-client-store`，但官方包只把它放在 devDependencies。客户端包必须自己加 `@deepseek-ai/dsh-client-store` 到 devDependencies，否则 `InjectFace` 会退化成 `any`。
- Schemastery 的 `Config` 不要写 `: Schema<Config>` 显式注解，`volatile()` 的推断类型会和 `Volatile<T>` 接口冲突。
- `tsconfig` 的 `rootDir: src` 下，客户端 `paths` 指向 `lib/*.d.ts` 是允许的；不要把生成的 `.d.ts` 放进 `include`。
- 本地 `dsh plugin add <path>` 安装的是软链，Host 运行时从包的真实路径解析依赖；因此包目录里必须已经有 `pnpm install` 后的 `node_modules`，并且 `lib/` 已构建。
