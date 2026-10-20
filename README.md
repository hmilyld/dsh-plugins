# DSH Plugins

hmilyld 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件 monorepo。所有 `@hmilyld/dsh-*` 插件都在这里开发、构建、测试和发布；新增插件直接放到 `packages/`，不要拆新仓库。

工程标准见 [`docs/plugin-standard.md`](./docs/plugin-standard.md)，受控偏差见 [`docs/known-deviations.md`](./docs/known-deviations.md)。

## 包

| 包 | 说明 |
| --- | --- |
| [`@hmilyld/dsh-beacon`](./packages/dsh-beacon) | 任务完成、提问、计划确认、审批时的 webhook 通知。 |
| [`@hmilyld/dsh-ocgo-usage-dock`](./packages/dsh-ocgo-usage-dock) | 输入框下方、token 用量下一行的 OpenCode Go 用量条，Host 侧通过 Typert Remote 提供数据，密钥存放在 credentials。 |
| `@hmilyld/dsh-plugin-kit`（private） | 内部设置/更新/测试 Kit，打包进插件，不单独发布。 |

每个插件的设置页都会检查 npm `latest`，发现新版本时显示版本号与对应 `CHANGELOG.md` 链接。

## 环境

- Node `^22.19.0 || >=24.0.0`
- pnpm `12.5.1`
- DSH `>=0.2.0-rc.2 <0.3.0`

## 开发

```bash
pnpm install
pnpm run check        # build + lint + test（CI 入口）
pnpm run build        # 所有包的宿主/客户端产物
pnpm run typecheck    # 需先 build（客户端类型依赖生成的 ./remote）
pnpm run test         # vitest + 各包产物测试
pnpm run pack:check   # publint 检查公开包
```

单包：

```bash
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run test
```

构建产物在各自 `lib/`，不提交 git；npm 发布由 `files` 白名单带上。

## 新增插件

```bash
pnpm gen:plugin dsh-foo
pnpm run check
```

脚手架会生成标准目录、双语 README、CHANGELOG、设置卡片、更新提示、locale、测试与 `cordis.patch.yml`，并自动加入根 tsconfig references。详细规则见工程标准。

## 安装到 DSH

npm 发布后：

```bash
dsh plugin --profile web add @hmilyld/dsh-ocgo-usage-dock
```

本地开发（先在本仓库 build）：

```bash
dsh plugin --profile web add /absolute/path/to/DSHPlugins/packages/dsh-ocgo-usage-dock
```

装完重启一次 `dsh web`。monorepo 根不是插件包，不能直接 `dsh plugin add github:hmilyld/dsh-plugins`；请用 npm、tarball 或本地绝对路径。

## 发布

Changesets 管理独立版本；每个用户可见改动必须有 changeset：

```bash
pnpm changeset
pnpm run version-packages
pnpm run check
# 推送后由 .github/workflows/release.yml 统一发布
```

发布走 npm Trusted Publishing（OIDC），workflow 不设置 `NODE_AUTH_TOKEN` / `registry-url`。首次发布需在 npm 包设置里绑定 `hmilyld/dsh-plugins` 与 `release.yml`。发布测试清单见 [`docs/release-testing.md`](./docs/release-testing.md)。

## License

MIT
