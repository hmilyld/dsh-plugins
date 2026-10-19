# @hmilyld/dsh-plugin-updates

## 0.1.0

### Minor Changes

- 首个版本：所有 `@hmilyld` DSH 插件共用的 npm 更新检测。
  
  - `createUpdateStore` 查询 npm registry 的 `latest` dist-tag，带 6 小时 `localStorage` 缓存、8 秒超时与静默失败。
  - 预发布感知的版本比较（`0.3.0-rc.1 < 0.3.0`，`0.2.10 > 0.2.9`）。
  - `UpdateNotice` 提供统一的设置页更新提示，链接到插件自己的 `CHANGELOG.md`。
