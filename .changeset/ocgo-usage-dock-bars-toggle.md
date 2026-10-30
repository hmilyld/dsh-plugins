---
"@hmilyld/dsh-ocgo-usage-dock": minor
---

- 新增「显示占比横条」开关：关闭后隐藏每个用量窗口的横条，仅保留百分比数字。
- 收紧内置性能与用量行和 OpenCode Go 用量行之间的间距，去掉多出的一行空白。
- 刷新与设置按钮改用官方 SVG 图标并固定 18×18，修复移动端齿轮图标比刷新按钮大的问题。
- 明确 composer dock 的注入顺序：官方先渲染 `conversation.composer.dock`、后渲染 `ContextMeter`，插件行仍用 `order` 排在视觉最后，不搬 DOM。
