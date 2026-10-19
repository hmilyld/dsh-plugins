/**
 * @hmilyld/dsh-ocgo-usage-dock —— Host 半边（Node ESM，运行在 dsh 宿主进程里）
 *
 * 职责：
 *   1. 声明 Config（Schemastery schema，全部字段 .volatile() → 设置镜像自动
 *      出表单卡片；apiKey 额外 .role('secret') → 值不出现在任何 API 响应体）。
 *   2. 解析 API Key（优先级：config.apiKey → env OPENCODE_GO_API_KEY →
 *      env OPENCODE_API_KEY → ctx.credentials 凭据库，静默降级）。
 *   3. 请求用量 GET {baseUrl}（默认 https://opencode.ai/zen/go/v1/usage，
 *      纯元数据接口，不消耗模型 token）；300 秒 TTL 内存缓存；
 *      fetch(true) 强制穿缓存（Client 手动刷新）。
 *   4. 定时轮询（refreshIntervalMs，setTimeout 链式自续）。
 *   5. 通过 typert Remote（SRC 标记，免代码生成）把用量暴露给浏览器端：
 *      服务 `ocgoUsage` 带可见 `typertRemote` 绑定，方法带 remote-methods
 *      描述符；Gateway 按运行时反射解析（详见 lib/client.js 对照的
 *      TYPERT_REMOTE 贡献描述）。
 *   6. 配置热生效：settings 服务每次写动作都会派发 Host 事件
 *      `settings/document-updated`（dsh-settings 源码已验证的行为），
 *      本插件监听后清缓存并重建定时器——无需重启 `dsh web`。
 *   7. 退出清理：定时器经 ctx.effect 归还；remote 服务经 ctx.provide 的
 *      fiber 生命周期随 entry 卸载自动注销。
 *
 * id 体系（与 @hmilyld/dsh-beacon 同款命名，任何一处不一致都会出 loading 循环）：
 *   - Loader entry id = 设置命名空间 = 远程命名空间 = 本文件导出 `name`
 *     = 'ocgo-usage-dock'（即 NS；cordis.patch.yml 的 `id` 必须与此一致）；
 *   - 包名 = cordis.patch.yml 的 `name` = package.json 的 name =
 *     lib/client.js 的模块注册 id = '@hmilyld/dsh-ocgo-usage-dock'。
 */
import z from '@deepseek-ai/schemastery';

/** 设置命名空间 = Loader entry id = 远程命名空间（id 体系铁律之一）。 */
export const NS = 'ocgo-usage-dock';

/**
 * Loader 插件名：Loader 取命名导出 `name` 校验与加载（= entry id = NS）。
 */
export const name = NS;

/** 缓存 TTL：300 秒（手动刷新时绕过）。 */
const CACHE_TTL_MS = 300_000;
/** 默认请求超时（毫秒），对应 Config.timeoutMs 的 default 值。 */
const DEFAULT_TIMEOUT_MS = 15000;
/** 默认自动刷新间隔（毫秒），对应 Config.refreshIntervalMs 的 default 值。 */
const DEFAULT_REFRESH_INTERVAL_MS = 300000;
/** 默认用量接口地址（OpenCode 官方用量查询端点，纯元数据）。 */
const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1/usage';
/** 兜底轮询间隔（毫秒）：配置非法时使用，防止 0ms 死循环。 */
const MIN_SAFE_INTERVAL_MS = 10000;
/** 兜底请求超时（毫秒）。 */
const MIN_SAFE_TIMEOUT_MS = 1000;
/** 环境变量候选（按优先级顺序尝试）。 */
const ENV_KEYS = ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY'];
/** 凭据库条目名（$DSH_HOME/.credentials.yaml 的 key，通过 ctx.credentials 读取）。 */
const CREDENTIAL_ENTRY = 'OPENCODE_GO_API_KEY';
/** settings 服务模式的热生效事件名（dsh-settings SettingsForms 派发）。 */
const SETTINGS_UPDATED_EVENT = 'settings/document-updated';
/** 遥测事件名：本地 cordis 树内标注"文档已刷新"（Host 内部观测用）。 */
const DOCS_READY_EVENT = 'ocgo-usage-dock:docs-ready';

/**
 * Schemastery schema：
 *   - 每个字段 .volatile()：缺一项设置卡片就没有那一项（volatileForm 只投影
 *     volatile 的字段——遗漏是设置卡片不出现的头号原因，见 README 常见问题）。
 *   - .role('secret')：值不回显任何 API 响应体（write-only 输入）。
 */
export const Config = z.object({
	apiKey: z.string()
		.default('')
		.description('OpenCode Go API Key（留空则从环境变量读取）')
		.role('secret')
		.volatile(),
	refreshIntervalMs: z.number()
		.default(DEFAULT_REFRESH_INTERVAL_MS)
		.description('自动刷新间隔（毫秒），默认 5 分钟')
		.volatile(),
	timeoutMs: z.number()
		.default(DEFAULT_TIMEOUT_MS)
		.description('请求超时（毫秒）')
		.volatile(),
	baseUrl: z.string()
		.default(DEFAULT_BASE_URL)
		.description('用量接口地址')
		.volatile(),
});

/**
 * API Key 的解析优先级（按序尝试，命中即停）：
 *   1. config.apiKey（配置即 volatile 包装 → current() 取实时值）
 *   2. process.env.OPENCODE_GO_API_KEY
 *   3. process.env.OPENCODE_API_KEY
 *   4. ctx.credentials.get('OPENCODE_GO_API_KEY')；服务不存在或读取失败
 *      都静默降级（不往上报错、不让学生中断加载）。
 * 不读取 OpenCode CLI 的本地登录态文件（其凭据库独立、计数口径不同）。
 */
function resolveApiKey(current, ctx) {
	// 1. 配置字段（volatile 包装 → 现场走值）
	const configured = typeof current.apiKey === 'string' ? current.apiKey.trim() : '';
	if (configured !== '') return { source: 'config', value: configured };
	// 2 / 3. 环境变量（按优先级）
	for (const envKey of ENV_KEYS) {
		const fromEnv = String(process.env[envKey] ?? '').trim();
		if (fromEnv !== '') return { source: envKey, value: fromEnv };
	}
	// 4. 凭据服务（静默降级）
	try {
		const creds = ctx.credentials?.get?.(CREDENTIAL_ENTRY);
		if (typeof creds === 'string' && creds.trim() !== '') {
			return { source: 'credentials', value: creds.trim() };
		}
	} catch {
		/* 静默降级 */
	}
	return { source: 'none', value: null };
}

/**
 * 用量响应形状归一。实测官方端点（2026-10）返回：
 *   {"usage": {"rolling": {status, percent(0-100), resetsAt}, "weekly": …, "monthly": …}}
 * 与任务书：rollingUsage/weeklyUsage/monthlyUsage.usagePercent 不同。这里把
 * 两种形状都折叠成 Client 约定的 {rollingUsage, weeklyUsage, monthlyUsage:
 * {status, usagePercent, resetInSec?, resetsAt?}}，一次性抹平字段差异。
 */
function normalizeUsageShape(data) {
	if (data === null || typeof data !== 'object') return null;
	// 形状一：任务书原样（rollingUsage 等在根）→ 原样放行
	if (typeof data.rollingUsage === 'object' && data.rollingUsage !== null) {
		return {
			rollingUsage: normalizeWindow(data.rollingUsage),
			weeklyUsage: normalizeWindow(data.weeklyUsage),
			monthlyUsage: normalizeWindow(data.monthlyUsage),
		};
	}
	// 形状二：官方实测（usage.{rolling, weekly, monthly}）
	const usage = typeof data.usage === 'object' && data.usage !== null ? data.usage : {};
	return {
		rollingUsage: normalizeWindow(usage.rolling),
		weeklyUsage: normalizeWindow(usage.weekly),
		monthlyUsage: normalizeWindow(usage.monthly),
	};
}
/** 单一窗口折叠：percent / usagePercent / percentage 全覆盖；缺失回 null。 */
function normalizeWindow(window) {
	if (window === null || typeof window !== 'object') {
		return { status: 'unknown', usagePercent: null };
	}
	const percent = Number(window.usagePercent ?? window.percent ?? window.percentage);
	const next = {
		status: typeof window.status === 'string' ? window.status : 'unknown',
		usagePercent: Number.isFinite(percent) ? percent : null,
	};
	if (Number.isFinite(Number(window.resetInSec))) next.resetInSec = Number(window.resetInSec);
	if (typeof window.resetsAt === 'string') next.resetsAt = window.resetsAt;
	return next;
}

/**
 * 数字配置兜底（volatile 包转 / 用户误填 0 或负数都会回退到默认值）。
 */
function numberOr(value, fallback) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * typert SRC 标记标志位：Remote 方法描述符挂在**原型**上（从 gateway 源码
 * readRemoteMethodDescriptor 的 KEY 提炼，值必须是 version=1 的 methods 数组）。
 */
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods';

/**
 * Host 半边的用量服务（Remote face）：
 *   - 实例经 ctx.provide('ocgoUsage', svc) 注册到 cordis 树；
 *   - 原型上挂 REMOTE_METHOD_DESCRIPTOR（version 1、direct 方法），
 *     对象自身挂 `typertRemote` 绑定（namespace = NS）——Gateway 的 SRC
 *     反射解析需要这两样东西（源码 collectSrcClaims + resolveSrcDescriptor）。
 *   - 幂等耐用：方法每次调用都从 `get()` 现场取闭包内部的最新配置/缓存，
 *     配置热更后不需要重建服务。
 */
class OcgoUsageRemote {
	/** Gateway 反射绑定：namespace 调进本服务的 wire 名（= NS）。 */
	typertRemote;

	constructor(state) {
		this.typertRemote = Object.freeze({
			service: this,
			serviceKey: 'ocgoUsage',
			namespace: NS,
		});
		this.state = state;
	}

	/**
	 * 强制刷新（绕过 TTL 缓存）。
	 * typert 调用结束后 return 普通可 JSON 化的结果对象。
	 */
	async fetch() {
		return this.state.fetch(true);
	}

	/**
	 * 默认（带缓存）取数：命中 TTL 直接回缓存；否则发起请求。
	 * Client 半边挂载时的初次拉取用它。
	 */
	async fetchCached() {
		return this.state.fetch(false);
	}

	/** 丢弃缓存（Client 想在配置刚变更后强制读新数据时使用）。 */
	async invalidate() {
		this.state.invalidate();
		return { ok: true };
	}
}

/** 在原型上登记 Remote 方法（版本 1 描述符，全部 direct 调用）。 */
Object.defineProperty(OcgoUsageRemote.prototype, REMOTE_METHOD_DESCRIPTOR, {
	configurable: true,
	value: Object.freeze({
		version: 1,
		methods: Object.freeze([
			Object.freeze({ method: 'fetch', invocation: Object.freeze({ kind: 'direct' }) }),
			Object.freeze({ method: 'fetchCached', invocation: Object.freeze({ kind: 'direct' }) }),
			Object.freeze({ method: 'invalidate', invocation: Object.freeze({ kind: 'direct' }) }),
		]),
	}),
});

/**
 * Cordis 插件入口：Loader 取命名导出 `name` / `Config` / `apply(ctx, config)`。
 * 本插件不依赖宿主里的其他服务：配置读取、凭据访问、网络请求都在 apply 闭包
 * 内协调，settings 服务存在时才挂热生效监听（`ctx.inject` 缺服务就不激活这里）。
 */
export function apply(ctx, config) {
	/** 缓存 + 单飞锁：同一时刻只会发起一个请求。 */
	let cache = null;
	let inflight = null;

	/**
	 * 读配置实时值：volatile 字段在运行时是 { get, [write] } 包装
	 * （cosmokit reference 协议；write 是全局注册符号，跨依赖副本稳定），
	 * 必须 .get() 解引用；普通字段直读。
	 * 每次读取都现场走值——设置页保存后立刻反映新值（热生效的前提）。
	 * 不直接 import cosmokit：本包以 `link:` 装进 profile 后，Node 按**真实
	 * 路径**解析包内导入（pnpm link 语义），宿主树里的这些 peer 未必可达；
	 * 这里用同一个 `Symbol.for` 键内联判断，行为与 cosmokit.isVolatile 完全一致。
	 */
	function field(key) {
		const value = config[key];
		if (value === null || typeof value !== 'object') return value;
		return Symbol.for('cosmokit.volatile.write') in value ? value.get() : value;
	}
	function current() {
		return {
			apiKey: field('apiKey'),
			refreshIntervalMs: field('refreshIntervalMs'),
			timeoutMs: field('timeoutMs'),
			baseUrl: field('baseUrl'),
		};
	}

	/** 停止当前轮询定时器（rebuild 前调用）。 */
	let timer = null;
	function stopTimer() {
		if (timer === null) return;
		clearTimeout(timer);
		timer = null;
	}

	/**
	 * 用量请求；所有错误折叠为返回值（不向上抛，打断不了定时器）。
	 * @param force true 时绕过 TTL 缓存（手动刷新 / 配置刚变更）
	 */
	async function fetchUsage(force = false) {
		const cfg = current();
		const apiKey = resolveApiKey(cfg, ctx);
		if (apiKey.value === null) {
			// 无 Key：静默回 no-key（Client 半边据此完全不渲染）
			return { ok: false, reason: 'no-key' };
		}
		const now = Date.now();
		if (!force && cache !== null && now - cache.fetchedAt < CACHE_TTL_MS) {
			return { ok: true, data: cache.data, cached: true };
		}
		if (inflight === null) {
			const url = String(cfg.baseUrl || DEFAULT_BASE_URL);
			const timeoutMs = numberOr(cfg.timeoutMs, DEFAULT_TIMEOUT_MS);
			inflight = (async () => {
				try {
					// 端点按 User-Agent 拦截非浏览器请求（实测 Python/undici UA → 403，
					// 浏览器 UA → 200）；浏览器式 UA + Accept 是能过墙的最小形态。
					const res = await fetch(url, {
						headers: {
							Authorization: `Bearer ${apiKey.value}`,
							Accept: 'application/json',
							'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
						},
						signal: AbortSignal.timeout(Math.max(MIN_SAFE_TIMEOUT_MS, timeoutMs)),
					});
					if (!res.ok) return { ok: false, reason: `http-${res.status}` };
					const data = normalizeUsageShape(await res.json());
					cache = { data, fetchedAt: Date.now() };
					return { ok: true, data, cached: false };
				} catch (error) {
					return {
						ok: false,
						reason: error?.name === 'TimeoutError' ? 'timeout' : 'network',
					};
				} finally {
					inflight = null;
				}
			})();
		}
		return inflight;
	}

	/** 重建轮询定时器（保存设置 / 初次启动都走这里）。 */
	function rebuildTimer() {
		stopTimer();
		const intervalMs = Math.max(MIN_SAFE_INTERVAL_MS, numberOr(cfgSafe().refreshIntervalMs, DEFAULT_REFRESH_INTERVAL_MS));
		// setTimeout 自续链：每轮 tick 先跑 fetchUsage， onError 静默；下一次
		// 延时基于 rebuildTimer 当时的 cfg（热改动到点即生效）。
		const tick = () => {
			void fetchUsage(false).then((result) => {
				// 把文档就绪事件派发给 trees 内部（不影响 Client——它走 remote）。
				if (result.ok) {
					try {
						ctx.emit(DOCS_READY_EVENT, result.data);
					} catch {
						/* 树内事件失败不影响业务 */
					}
				}
			}).catch(() => {
				/* fetchUsage 自身不抛；此处兜底 */
			});
			timer = setTimeout(tick, intervalMs);
		};
		timer = setTimeout(tick, intervalMs);
	}

	/** 健壮的配置读取（还在 plugin 依赖树 map 内时能安全取字段）。 */
	function cfgSafe() {
		const raw = current() ?? {};
		return {
			refreshIntervalMs: numberOr(raw.refreshIntervalMs, DEFAULT_REFRESH_INTERVAL_MS),
			timeoutMs: numberOr(raw.timeoutMs, DEFAULT_TIMEOUT_MS),
			baseUrl: String(raw.baseUrl || DEFAULT_BASE_URL),
			apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
		};
	}

	/** 1. 轮询定时器（可重建）。 */
	rebuildTimer();
	ctx.effect(() => () => stopTimer());

	/**
	 * 2. 配置热生效：settings 服务每次写动作都会派发
	 *    `settings/document-updated`（ns, revision）；ns 与本 entry id 一致时，
	 *    清缓存、立即强制取一次数据，并按新的 refreshIntervalMs 重建定时器。
	 *    监听的卸载句柄进入 explicitDisposals，fiber 清理时逐个注销
	 *    （可逆副作用规范 5：不依赖 cordis 内部对 listener 的隐式回收）。
	 *    服务不存在时（比如宿主没装 settings），这里不注册、轮询保持出厂节奏。
	 */
	const explicitDisposals = [];
	ctx.effect(() => () => {
		for (const dispose of explicitDisposals.splice(0)) {
			try {
				dispose();
			} catch {
				/* 幂等清理 */
			}
		}
	});
	ctx.inject(['settings'], (settingsCtx) => {
		const unwatch = settingsCtx.on(SETTINGS_UPDATED_EVENT, (ns) => {
			if (ns !== NS) return;
			cache = null; // 配置换了（比如 apiKey），旧缓存作废
			void fetchUsage(true);
			rebuildTimer();
		});
		if (typeof unwatch === 'function') explicitDisposals.push(unwatch);
	});

	/** 3. 暴露 typert Remote 服务给 Client 半边（`ctx.remote.<NS>.fetch()`）。 */
	ctx.provide('ocgoUsage', new OcgoUsageRemote({
		fetch: fetchUsage,
		invalidate() {
			cache = null;
		},
	}));
}
