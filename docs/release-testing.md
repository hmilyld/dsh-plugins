# 发布流程测试清单

## 当前状态（2026-10-20）

- 本地版本：`@hmilyld/dsh-beacon@0.3.0`、`@hmilyld/dsh-ocgo-usage-dock@0.3.0`、`@hmilyld/dsh-opencode-import@0.1.1`。
- npm：beacon `0.3.0`、ocgo `0.3.0`、opencode-import `0.1.1` 均已发布。
- 事故记录：`dsh-opencode-import@0.1.0` 用 `npm publish` 发布，`catalog:` / `workspace:*` 未解析，
  安装报 `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`；已用 `0.1.1` 重新发布并弃用 `0.1.0`。
- `pnpm publish --dry-run` 两个包均已通过（含 `prepublishOnly` 的 build + test）。
- 本机 npm 未登录（`npm whoami` 返回 401）。
- GitHub 仓库还没有 remote；`gh` 已登录 `hmilyld`。
- 私有 Kit `@hmilyld/dsh-plugin-kit` 不发布，`pnpm publish` 会把它替换成 `0.0.0` 放进 devDependencies。

### 今天最短路径（手动 bootstrap）

```bash
# 1. 登录官方 registry（2FA）
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/

# 2. 先发 ocgo（新包必须先 bootstrap）
cd packages/dsh-ocgo-usage-dock
pnpm publish --registry=https://registry.npmjs.org/ --access public --otp=<6位动态码>

# 3. 再发 beacon
cd ../dsh-beacon
pnpm publish --registry=https://registry.npmjs.org/ --access public --otp=<新的6位动态码>

# 4. 验证
npm view @hmilyld/dsh-ocgo-usage-dock@0.3.0 version --registry=https://registry.npmjs.org/
npm view @hmilyld/dsh-beacon@0.3.0 version --registry=https://registry.npmjs.org/
```

两个包都发布成功后，再到 npm 包设置里配置 Trusted Publisher（见下方前置条件），最后创建并推送 GitHub 仓库，后续才走 Changesets + OIDC。

> 不要用 `npm publish`：它不会替换 `workspace:*` 或 `catalog:`，packed manifest 里会残留未解析协议，
> 包直接装不上。统一用 `pnpm publish`；各包 `prepublishOnly` 已接入
> `tooling/build/verify-publish-client.mjs`，用 npm 发布会当场失败。


本文件记录发布链路中尚未在真实 npm 上验证的部分。明天按顺序执行，任何一步失败先停，不要继续发第二个包。

## 前置条件

- [ ] npm 上两个包都已存在（`@hmilyld/dsh-beacon` 已发布过；`@hmilyld/dsh-ocgo-usage-dock` 目前是 404，需要首次 bootstrap）。
- [ ] npm Trusted Publisher 绑定：
  - Organization/user：`hmilyld`
  - Repository：`hmilyld/dsh-plugins`
  - Workflow filename：`release.yml`（只填文件名）
  - Environment：留空
- [ ] 首次发布 bootstrap：新包必须先人工带 2FA 发一次，npm 才允许配置 Trusted Publisher。
- [ ] 本机 `~/.npmrc` 的 registry 若是镜像，发布命令必须显式指向 `https://registry.npmjs.org/`。

## 测试步骤

1. **本地检查**
   ```bash
   pnpm run check
   pnpm run pack:check
   ```
   期望：测试全绿；publint 只有已记录的 `lib/client.js` CJS 警告。

2. **检查发布面**
   ```bash
   pnpm --filter @hmilyld/dsh-beacon pack --pack-destination /tmp/dsh-pack
   pnpm --filter @hmilyld/dsh-ocgo-usage-dock pack --pack-destination /tmp/dsh-pack
   ```
   确认 tarball 包含 `lib/index.js`、`lib/client.js`、`lib/types/**`、`cordis.patch.yml`、`CHANGELOG.md`，不包含 `.map` / `tsbuildinfo` / `tests`。

3. **Changesets**
   ```bash
   pnpm changeset
   pnpm run version-packages
   ```
   确认两个包的 `CHANGELOG.md` 有 0.3.0 小节，版本号正确。

4. **OIDC 发布**
   - 推送 `main`，确认 `changesets/action` 打开 Version Packages PR。
   - 合并后观察 `Release` workflow：
     - `pnpm install --frozen-lockfile`
     - `pnpm run check`
     - `changesets/action` → `pnpm run release`（`changeset publish`）
   - 重点看 OIDC：workflow 没有 `NODE_AUTH_TOKEN` / `registry-url`，只靠 `id-token: write`。
   - 成功后用 `npm view <包>@0.3.0 dist.integrity` 或 registry 元数据确认 `trustedPublisher` 与 provenance。

5. **安装验证**
   ```bash
   dsh plugin --profile web add @hmilyld/dsh-beacon@0.3.0
   dsh plugin --profile web add @hmilyld/dsh-ocgo-usage-dock@0.3.0
   ```
   重启 `dsh web`，确认设置页、dock、更新提示都正常。

## 已知风险

| 风险 | 说明 | 失败时 |
| --- | --- | --- |
| pnpm OIDC | pnpm 11.0.7+ 有原生 OIDC；12.5.1 预计可用，但未在本仓库真实发布验证 | 查看 workflow 日志中的 OIDC 交换；可临时加 `NPM_TOKEN` + `NODE_AUTH_TOKEN` + `registry-url` 回退 |
| `changesets/action` + `pnpm publish` | `publish` 命令是 `pnpm run release`，内部是 `changeset publish` | 可改为逐包 `npm publish`，或确认 `pnpm publish` 的 OIDC 行为 |
| 首次发布 | 新包没有 Trusted Publisher 入口 | 先本机 `npm publish --otp=<code>` 发 0.3.0，再配置 OIDC |
| npm 镜像 | 本机 `~/.npmrc` 可能指向 npmmirror | 发布时显式 `--registry=https://registry.npmjs.org/`；不要污染 `pnpm-lock.yaml` |
| `prepublishOnly` | 每个包发布前都会 build + test | 若超时，检查 `pnpm run test` 内的 legacy smoke 与本地 HTTP server |
| `engines.dsh` | `>=0.2.0-rc.2 <0.3.0` 依赖 `includePrerelease` 判定 | 用当前 DSH 0.2.0-rc.2 验证；DSH 升 0.3 时重新评估 |
| Kit 私有 | `@hmilyld/dsh-plugin-kit` 是 private，不发布 | `pnpm pack` 已内联进两个插件；不要把它加进 `dependencies` |

## 后续待办

- [ ] 把 `packages/dsh-beacon/tests/legacy-smoke.mjs` 分批迁移为 vitest spec（当前由 `test` 在 vitest 后单独执行）。
- [ ] 评估桌面端严格 CSP 下 Client 更新检测的降级方案（必要时改 Host 侧共享服务）。
- [ ] DSH 升级时复核 `typert-protocol.d.ts` shim 与 `engines.dsh` 范围。
