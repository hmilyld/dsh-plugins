# 已知偏差

本仓库以官方 DSH 工程为准；以下偏差是受控的，必须在每次 DSH 升级时复核。

## 1. Typert 协议 ambient shim

- **偏差**：官方仓库把 `@deepseek-ai/dsh-typert-protocol` 作为 workspace 包，生成器可直接识别 `@Remote` / `TypertRemoteService`。我们消费 npm 上的协议包，符号位于 workspace 之外，生成器会认为没有 Remote 方法。
- **处理**：仓库根 `typert-protocol.d.ts` 是唯一一份 ambient 声明；Typert 插件的 `src/index.ts` 用 `/// <reference path="../../../typert-protocol.d.ts" />` 引入，`tsconfig.json` 不再写 `paths`。根文件只参与构建，不发布。
- **为什么不是每包一份**：生成器把 workspace 内所有包放进同一个 TypeScript program，多个包各自声明同名 ambient module 时只会认第一个声明，第二个包的 `extends TypertRemoteService` 会被判成跨包引用并报 `package reference TypertRemoteService is not exported ...`。
- **复核**：每次 DSH 升级后确认 `Remote` / `TypertRemoteService` / `RemoteResult` / `TypertRemoteContribution` 的签名未变；若生成器改为按包独立分析，可改回每包一份。

## 2. 更新检测走 Client

- **偏差**：官方插件的外部网络通常走 Host。更新检测需要覆盖所有插件，且不应要求每个插件都增加一个 Typert Remote，因此浏览器直接查询 npm registry。
- **处理**：`@hmilyld/dsh-plugin-kit/updates` 提供 6 小时缓存、8 秒超时、404 视为未发布、离线/CSP 静默失败。
- **复核**：若 DSH 桌面端启用严格 CSP 导致无法访问 registry，改为 Host 侧共享服务。

## 3. 不采用 README.i18n.yaml 配对校验

- **偏差**：官方仓库用 `README.i18n.yaml` 记录中英文档的逐节哈希。
- **处理**：只要求 `README.md`（英）与 `README.zh.md`（中）同时存在并保持内容同步，不做自动哈希校验。
- **复核**：若文档量继续增长，再引入配对校验脚本。

## 4. 构建器使用 tsdown（已对齐）

这不是偏差，但记录工具链：tsdown `0.22.x` + 官方 `typertPlugin`（package 模式）。若未来 tsdown 与生成器不兼容，允许回退 esbuild，但产物路径必须保持 `lib/index.js` / `lib/client.js` / `lib/types/**`。

## 5. `lib/client.js` 的 CJS 扩展名警告

- **现象**：publint 提示 `exports["./client"].default` 是 CJS 但按 ESM 解释，建议 `.cjs`。
- **原因**：该文件不是 Node 模块，而是 DSH 浏览器 ModuleLoader 的 closure factory；官方插件同样使用 `lib/client.js`。
- **处理**：保留 `.js`，接受 publint warning；不要改为 `.cjs`，否则模块表路径与官方契约不一致。

## 6. `conversation.composer.dock` 换行样式

- **偏差**：官方 composer dock 是单行 `display:flex`，没有 `flex-wrap`。用量条要落在自带 token 用量下一行，只能在插件里注入一条 `[data-composer-dock]{flex-wrap:wrap;row-gap:2px}`。
- **处理**：样式只作用于官方稳定 data 属性，插件卸载时移除；entry 使用 `flex: 1 0 100%; order: 10` 占满下一行。`row-gap` 必须收紧，否则 dock 自身的 `gap: 12px` 会在两行之间留出一条空行。
- **DOM 顺序**：官方 `InputBar` 先渲染 `conversation.composer.dock`，再渲染内置 `ContextMeter`，所以上下文占比始终是 dock 的最后一个 DOM 子节点；插件行靠 CSS `order` 排在它后面。不要用 DOM portal / querySelector 去搬节点。
- **复核**：若官方后续提供多行 composer dock 或独立“below token meter”slot，删除这条注入。
