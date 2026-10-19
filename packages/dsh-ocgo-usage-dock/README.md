# @hmilyld/dsh-ocgo-usage-dock

DSH（DeepSeek Harness）**Web 插件**：在对话输入框下方独立一行显示 OpenCode Go 用量条（5 小时滚动窗口 / 本周窗口 / 本月窗口），并提供本插件设置页。适配 **DSH 0.2.0-rc.2**。

```text
[DSH 自带 token 用量行]（保持原位，不被挤动）
OpenCode Go  ● 5h 29%  ● 周 94%  ● 月 69%        [⟳] [⚙]
```

- 每个窗口默认显示**已用百分比**；鼠标悬停出现提示，包含**重置时间**（绝对时间 + 剩余时长），方便控制用量。
- 彩点健康度：< 60% 绿、60–85% 黄、≥ 85% 红。
- 数据来自 OpenCode 官方用量接口（纯元数据），不消耗任何模型 token。
- 未配置 API Key 时输入框下方**不显示**任何内容（静默）。
- 点 ⟳ 立即穿透 5 分钟缓存刷新；点 ⚙ 打开设置面板并定位到插件页。

## 安装

要求 Node ≥ 20、DSH 0.2.0-rc.2（`dsh --version`）。

```bash
# 1. 获取代码（clone 到任意目录，eg: ~/Codespace）
git clone https://github.com/hmilyld/dsh-ocgo-usage-dock.git
cd dsh-ocgo-usage-dock

# 2. 安装依赖（首次必做；本地路径安装时插件按包目录真实路径解析依赖）
npm install

# 3. 装进 web profile
dsh plugin --profile web add "$(pwd)"

# 4. 校验组合（不启动 app）
dsh --profile web --dump-config | grep -A8 ocgo-usage-dock

# 5. 启动 / 重启 dsh web，输入框下方出现用量条
dsh web
```

升级本插件：先在插件页停用/卸载旧版（或 `dsh plugin --profile web remove @hmilyld/dsh-ocgo-usage-dock`），然后重复 2–3 步重启 `dsh web`。

**换仓 / 更名后的干净重装**：如果 profile 里残留旧名字的行（`dsh-ocgo-usage-dock`），重新安装不会自愈——需要在 `~/.dsh/profiles/web/package.json` 里手工删掉旧依赖键与 bundles 行，再重装（症状：启动日志出现 duplicate loader entry）。

## 配置项

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| API Key | （空） | OpenCode Go API Key；留空则按优先级自动解析（见下） |
| 刷新间隔（秒） | `300` | 自动轮询间隔；设置页按"秒"编辑，最小 10 秒 |
| 请求超时（秒） | `15` | 单次请求等待上限；最小 1 秒 |
| 接口地址 | `https://opencode.ai/zen/go/v1/usage` | 用量接口地址（一般不用改） |

配置入口：所有字段都在插件设置页表单里（见下）。全部支持热修改（保存即生效，无需重启）。

### API Key 的解析优先级

每次请求前按序尝试、命中即停：

1. 插件设置里填的 API Key；
2. 启动 dsh 前的环境变量 `OPENCODE_GO_API_KEY`；
3. 环境变量 `OPENCODE_API_KEY`；
4. DSH 凭据库（`$DSH_HOME/.credentials.yaml`）里的 `OPENCODE_GO_API_KEY` 条目。

API Key 的值**不会**回显到任何页面或 API 响应里（write-only，只写不读）。

### API Key 获取

1. 登录 OpenCode Web 控制台；
2. 在 **API Keys / 设置** 页创建一个 Key；
3. 复制后：直接在插件设置页填（推荐），或导出环境变量：

```bash
export OPENCODE_GO_API_KEY='你的 key'
dsh web
```

## 设置页使用

**唯一入口**：侧边栏 **插件（Plugins）** → 点开 **OpenCode Go 用量** 插件卡片 → 页面内的表单。

1. 修改字段（API Key 是密码输入框；间隔/超时以秒编辑）；
2. 按 **保存**，按钮短暂显示"保存中…"；
3. 成功后配置**立即生效**：自动重建轮询定时器、清掉旧缓存、马上请求一次新数据——**无需重启 `dsh web`**；
4. 无效输入（刷新间隔 < 10 秒、超时 < 1 秒、地址为空）会被卡片拦截并提示，不会保存。

快速验证：

```bash
dsh --profile web --dump-config | grep -A9 ocgo-usage-dock
# 期望看到 id: ocgo-usage-dock 与 config 段（apiKey/refreshIntervalMs/timeoutMs/baseUrl）
```

### 用量条操作

- **⟳**：立即刷新（绕过 5 分钟服务端缓存）；加载中显示 `…` 且禁用；
- **⚙**：打开设置面板并定位到插件页（即上面的设置入口）。

## 常见问题

### 用量条不显示

- **没配 Key**：插件设置页填好 Key 并保存，然后点用量条上的 ⟳；全链路都没有 Key 时本插件保持静默（这是设计行为，不是故障）；
- **还没请求过**：等下一次轮询（默认 5 分钟）或点 ⟳。

### 数值一直不更新 / 错误行

- 错误行只会在**真实失败**时出现（超时 / 网络不通 / 接口响应非 2xx），并带"重试"按钮；
- 接口地址别改错——默认 `https://opencode.ai/zen/go/v1/usage`；
- 宿主进程级代理需在启动 dsh 前 `export HTTPS_PROXY=…`（请求从 dsh 进程发出，浏览器不参与）；
- 修改设置里的字段（比如换了 Key 或间隔）保存后立即生效——不需要重启。

### 点击 ⚙ 没有反应 / 没定位到插件页

设置面板会被打开；如果没自动落到"插件"页（其他对话框挡住、或侧栏折叠），手动点一下导航里的"插件"即可。

### 安装后启动日志出现 `entry did not activate ... failed to import`

本地路径安装时插件按**包目录**解析依赖——第一次安装前必须先在包目录 `npm install`（依赖在 `devDependencies` 里声明）；漏了这步会出现这个告警，补跑 `npm install` 后重启 `dsh web` 即可。

### 停用 / 重新启用后

停用插件会清掉用量条与非持久副作用（定时器等），设置保留；重新启用后自动恢复。

## 数据说明

- 用量数据实时从 OpenCode 拉取并缓存 5 分钟；不采集、不回传任何本地数据；
- API Key 只保存在宿主进程与你的 profile 文件里，浏览器端永不可见；
- 请求需要浏览器式 User-Agent（本插件已自动处理，拦截的是非浏览器客户端）。

## License

MIT（见 [LICENSE](./LICENSE)）。
