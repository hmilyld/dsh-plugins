# @hmilyld/dsh-plugin-updates

`@hmilyld` DSH 插件共用的**更新检测**能力。所有插件（含后续新增）都应在设置页展示更新提示：本包查询 npm registry 的 `latest` dist-tag，做预发布感知的版本比较，并通过 `UpdateNotice` 渲染一行提示，链接到对应包的 `CHANGELOG.md`。

## 使用

在插件客户端：

```ts
import { createUpdateStore, UpdateNotice } from '@hmilyld/dsh-plugin-updates'

const updates = createUpdateStore({
  packageName: '@hmilyld/dsh-my-plugin',
  currentVersion: __PKG_VERSION__, // 由 tooling/build/build-client.mjs 注入
  changelogUrl: 'https://github.com/hmilyld/dsh-plugins/blob/main/packages/dsh-my-plugin/CHANGELOG.md',
})
void updates.refresh(false)
```

把 store 放进 slot 的 `hooks`（例如 `hooks: { update: updates }`），组件即可用 `props.useUpdate((s) => s)` 读取，并渲染：

```tsx
<UpdateNotice state={props.useUpdate((s) => s)} changelogUrl={CHANGELOG_URL} labels={{ available: '发现新版本 v{latest}（当前 v{current}）', changelog: '查看更新说明' }} />
```

## 行为

- 缓存以 `dsh-plugin-updates:v1:<包名>` 写入 `localStorage`，默认 6 小时有效；`refresh(true)` 强制穿透。
- 请求 8 秒超时；失败只记录 `error`，不抛出，不阻塞 UI。
- 版本比较支持 `0.3.0` vs `0.3.0-rc.1`、`0.2.10` vs `0.2.9` 等预发布场景。
- 在无 `localStorage`、离线或 CSP 限制下静默降级。

## 开发

```bash
pnpm --filter @hmilyld/dsh-plugin-updates run typecheck
pnpm --filter @hmilyld/dsh-plugin-updates run test
```

## License

MIT
