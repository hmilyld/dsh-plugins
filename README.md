# DSH Plugins

hmilyld 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件 monorepo。所有 `@hmilyld/dsh-*` 插件都在这里开发、构建、测试和发布；新增插件请直接放到 `packages/` 下，不要再拆新仓库。

## 包

| 包 | 说明 |
| --- | --- |
| [`@hmilyld/dsh-beacon`](./packages/dsh-beacon) | 任务完成、提问、计划确认、审批时的 webhook 通知。 |
| [`@hmilyld/dsh-ocgo-usage-dock`](./packages/dsh-ocgo-usage-dock) | 输入框上方的 OpenCode Go 用量条，Host 侧通过 Typert Remote 提供数据，密钥存放在 credentials。 |
| [`@hmilyld/dsh-plugin-updates`](./packages/dsh-plugin-updates) | 所有插件共用的 npm 更新检测与设置页更新提示。 |

每个插件的设置页都会通过 `@hmilyld/dsh-plugin-updates` 检查 npm `latest`，发现新版本时显示版本号与对应 `CHANGELOG.md` 链接。新增插件也必须接入这一能力。

## 环境

- Node `^22.19.0 || >=24.0.0`
- pnpm `12.5.1`
- DSH `0.2.0-rc.2`（插件声明 `>=0.2.0-rc.2 <0.3.0`）

## 开发

```bash
pnpm install          # 安装 workspace 依赖
pnpm run build        # 构建所有包（含 Typert 生成与客户端 bundle）
pnpm run typecheck    # Host + Client 两套 tsconfig 全量类型检查（需先 build）
pnpm run test         # 运行所有包的 smoke test
pnpm run check        # build + test（CI 用）
```

只构建一个包：

```bash
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
```

构建产物在各自包的 `lib/` 下。`lib/` 不提交到 git；npm 发布时由 `files` 白名单带上。

## 安装到 DSH

npm 发布后：

```bash
dsh plugin --profile web add @hmilyld/dsh-ocgo-usage-dock
```

本地开发时可直接链接包目录（先在本仓库执行 `pnpm run build`）：

```bash
dsh plugin --profile web add /absolute/path/to/DSHPlugins/packages/dsh-ocgo-usage-dock
```

`dsh plugin` 会把包写进 profile 的 `package.json` 与 `dsh.profile.bundles`，并应用包内的 `cordis.patch.yml`。装完后重启一次 `dsh web`。

> 从 GitHub 安装 monorepo 子包时，GitHub 仓库根目录不是插件包，不能直接 `dsh plugin add github:hmilyld/dsh-plugins`。请使用 npm 包、已构建的 tarball，或上面这种本地绝对路径。

## 新增插件

1. 复制 `packages/dsh-ocgo-usage-dock` 的构建骨架，改包名、entry id、`cordis.patch.yml`。
2. 保持 `entry id` 与设置命名空间稳定；已有用户配置依赖它。
3. Host 侧优先使用官方服务与 Typert Remote，不要手写 wire schema。
4. 设置字段用 Schemastery 定义默认值，可编辑字段加 `.volatile()`；密钥走 `apiKeyEnv` + credentials，不要把 secret 写进 settings。
5. 客户端只通过 `ctx.slots.register` / `ctx.configForms` / `ctx.remote` 协作，不直接操作 DOM，不 import Host 包。
6. 在 `packages/<name>/test/` 加 smoke test，至少覆盖 manifest、生成产物、配置解析、Host 行为与客户端 bundle。

详细规范见 [`docs/plugin-standard.md`](./docs/plugin-standard.md)。

## 发布

版本由 [Changesets](https://github.com/changesets/changesets) 管理，每个包独立版本：

```bash
pnpm changeset
pnpm run version-packages
pnpm run build
pnpm run release
```

发布前确保 npm Trusted Publisher 的仓库指向 `hmilyld/dsh-plugins`，workflow 文件名与 `.github/workflows/release.yml` 一致。

## License

MIT
