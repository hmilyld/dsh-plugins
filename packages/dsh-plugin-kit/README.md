# @hmilyld/dsh-plugin-kit（private）

`@hmilyld` DSH 插件的内部设置与更新 Kit。**不发布到 npm**，由插件以 `workspace:*` 引入并在构建时打包进各自的 `lib/client.js`。

## 内容

| 模块 | 用途 |
| --- | --- |
| `PluginSettingsForm` | 官方 `SettingsForm` 外壳 + 更新提示 |
| `SettingsTextareaField` | 多行/JSON 字段 |
| `SettingsToggleField` | 布尔行 + 覆盖重置 |
| `SettingsCredentialField` | `apiKeyEnv` + 官方 secret 控件 + legacy 提示 |
| `settingsSecondsField` / `settingsBooleanField` | 常用字段转换 |
| `createStore` | slot hooks 使用的快照 store |
| `createUpdateStore` / `UpdateNotice` | npm 更新检测与提示 |
| `typert-protocol.d.ts` | Typert 生成器的 ambient 协议 shim |

## 使用

```ts
import {
  createUpdateStore,
  formLabels,
  PluginSettingsForm,
  SettingsValueField,
} from '@hmilyld/dsh-plugin-kit'
```

版本注入来自共享 tsdown preset：`__PKG_VERSION__`、`__PKG_CHANGELOG_URL__`。

## 开发

```bash
pnpm --filter @hmilyld/dsh-plugin-kit run build
pnpm --filter @hmilyld/dsh-plugin-kit run test
```

## License

MIT
