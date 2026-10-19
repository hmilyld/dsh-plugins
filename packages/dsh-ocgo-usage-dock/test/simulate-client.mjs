/**
 * @hmilyld/dsh-ocgo-usage-dock —— Client 半边无头物化验证（开发用）
 *
 * 在 Node 里复刻浏览器模块表的最小面，执行整个 client bundle：
 *   1. window.__ModuleLoader__ 桩：捕获 load({id, factory})；
 *   2. require 桩：react / react-jsx（web 静态模块表同语义，react 18 已本包 vendored）；
 *   3. slots（官方 SlotRegistry.inject 的声明等待语义简化版）/ configForms /
 *      remote（$mount + 命名空间方法）三个服务仿真；
 *   4. 宿主先声明三个槽（conversation.composer.dock / settings.section /
 *      plugins.bundle.config，模拟 ui-conversation / ui-settings-general /
 *      ui-plugin-manager 装配链），然后物化 factory → apply(ctx)：
 *      断言 ledger 里出现 id/order/label/key 正确的三份注册；
 *   5. Remote 贡献形状（namespace=NS + 三个 direct 方法）；
 *   6. ReactDOMServer 直出 UsageDock / SettingsCard：静默 / 加载中语义。
 *
 * 运行：node test/simulate-client.mjs（不出网）
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function check(name, condition, detail) {
	if (condition) {
		console.log(`ok    - ${name}`);
		return;
	}
	failed += 1;
	console.error(`FAIL  - ${name}${detail ? `: ${detail}` : ''}`);
}

/* ---------- 1. 环境桩 ---------- */

const loaded = [];
globalThis.window = {
	__ModuleLoader__: {
		load(record) {
			loaded.push(record);
		},
	},
};
globalThis.document = {
	querySelector() {
		return null;
	},
	querySelectorAll() {
		return [];
	},
	createElement(tag) {
		return { tag, dataset: {}, style: {}, textContent: '' };
	},
	head: { appendChild() {} },
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-sim' }, configurable: true });

const reactModule = await import('react');
const reactJsx = await import('react/jsx-runtime');
const reactDomModule = await import('react-dom');
const moduleTable = {
	react: { default: reactModule, ...reactModule },
	'react/jsx-runtime': reactJsx,
	'react-dom': { default: reactDomModule, ...reactDomModule },
};
const requireStub = (specifier) => {
	const row = moduleTable[specifier];
	if (!row) throw new Error(`模块表缺行: ${specifier}`);
	return row;
};

/* ---------- 2. 槽位 ledger（对齐 SlotCore 的关键语义） ---------- */

function makeFakeSlotCore() {
	const records = new Map();
	const record = (key) => {
		let rec = records.get(key);
		if (!rec) {
			rec = {
				spec: undefined,
				declarationEpoch: 0,
				version: 0,
				entries: [],
				listeners: new Set(),
				declarationListeners: new Set(),
			};
			records.set(key, rec);
		}
		return rec;
	};
	const notify = (rec) => {
		for (const fn of [...rec.listeners]) {
			fn();
		}
	};
	return {
		entries(key) {
			return [...(records.get(key)?.entries ?? [])];
		},
		specDynamic(key) {
			return records.get(key)?.spec;
		},
		getVersion(key) {
			return records.get(key)?.version ?? 0;
		},
		subscribe(key, fn) {
			const rec = record(key);
			rec.listeners.add(fn);
			return () => {
				rec.listeners.delete(fn);
			};
		},
		subscribeDeclaration(key, fn) {
			const rec = record(key);
			rec.declarationListeners.add(fn);
			return () => {
				rec.declarationListeners.delete(fn);
			};
		},
		register(options, component) {
			const rec = record(options.name);
			if (!rec.spec) throw new Error(`slot "${options.name}" is not declared（宿主必须先声明）`);
			const entry = {
				component,
				options: {
					id: options.id,
					key: options.key,
					order: options.order,
					label: options.label,
				},
				inject: options.inject,
			};
			rec.entries.push(entry);
			rec.version += 1;
			notify(rec);
			return () => {
				if (!rec.entries.includes(entry)) return;
				rec.entries = rec.entries.filter((row) => row !== entry);
				rec.version += 1;
				notify(rec);
			};
		},
		__declare(key, spec) {
			const rec = record(key);
			if (rec.spec) throw new Error(`slot ${key} 已声明（模拟器不能重复声明）`);
			rec.spec = spec;
			rec.declarationEpoch += 1;
			for (const fn of [...rec.declarationListeners]) {
				fn();
			}
		},
	};
}
const slotCore = makeFakeSlotCore();

/**
 * slots 服务face：与官方 SlotRegistry.inject 一致的「声明就绪才 register、
 * 卸载可逆」骨架（简化版 reconcile）。
 */
const slotInventory = new Map();
const slots = {
	inject(key, callback) {
		let active = null;
		let stopped = false;
		const reconcile = () => {
			if (stopped) return;
			const spec = slotCore.specDynamic(key);
			if (!spec || active) return;
			const dispose = callback();
			active = dispose ?? (() => {});
		};
		const unwatch = slotCore.subscribeDeclaration(key, reconcile);
		reconcile();
		const stop = () => {
			if (stopped) return;
			stopped = true;
			unwatch();
			if (active) active();
		};
		slotInventory.set(key, stop);
		return stop;
	},
	register: (options, component) => slotCore.register(options, component),
};

/* ---------- 3. configForms / remote 服务仿真 ---------- */

function makeConfigForms() {
	let status = 'loading';
	let value = undefined;
	const writes = [];
	const listeners = new Set();
	const form = {
		getSnapshot: () => ({
			status,
			value,
			writable: true,
			mode: 'host',
			revision: status === 'ready' ? 2 : undefined,
		}),
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		set: async (field, next) => {
			writes.push(['set', field, next]);
			return true;
		},
		unset: async (field) => {
			writes.push(['unset', field]);
			return true;
		},
	};
	return {
		form,
		writes,
		ready() {
			status = 'ready';
			value = { apiKey: '', refreshIntervalMs: 300000, timeoutMs: 15000, baseUrl: 'https://opencode.ai/zen/go/v1/usage' };
			for (const fn of [...listeners]) {
				fn();
			}
		},
	};
}
const configFormsState = makeConfigForms();
/** 共享 describe 镜像面（ConfigForms.describe() 的对等形状）。 */
const describeFace = {
	view: null,
	getSnapshot: () => describeFace.view,
	subscribe() {
		return () => {};
	},
	ensure() {
		return Promise.resolve();
	},
};
const configForms = {
	get: () => configFormsState.form,
	describe: () => describeFace,
};

const contributions = [];
const remoteServer = {
	fetch: async () => ({ ok: true, value: { ok: true, data: { rollingUsage: { usagePercent: 1 }, weeklyUsage: { usagePercent: 20 }, monthlyUsage: { usagePercent: 11 } } } }),
	fetchCached: async () => ({ ok: true, value: { ok: true, data: { rollingUsage: { usagePercent: 1 }, weeklyUsage: { usagePercent: 20 }, monthlyUsage: { usagePercent: 11 } } } }),
};
const remote = {
	$mount(contribution) {
		contributions.push(contribution);
		return Promise.resolve(() => {});
	},
};

/* ---------- 4. 执行 bundle：注册 → 物化 → apply ---------- */

const bundleSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8');
check('bundle 形态（__ModuleLoader__.load + 经典脚本）', bundleSource.includes('window.__ModuleLoader__.load') && bundleSource.includes("id: '@hmilyld/dsh-ocgo-usage-dock'"));

new Function('window', 'document', 'require', bundleSource)(globalThis.window, globalThis.document, requireStub);
const record = loaded.at(-1);
check('load() 注册 id = 包名（模块表 key）', record?.id === '@hmilyld/dsh-ocgo-usage-dock', record?.id);
check('factory 是函数（物化出口存在）', typeof record?.factory === 'function');

/** 宿主先装配声明（对照三个真宿主来源） */
slotCore.__declare('conversation.composer.dock', { kind: 'list', scope: 'session' });
slotCore.__declare('settings.section', { kind: 'list', scope: 'root' });
slotCore.__declare('plugins.bundle.config', { kind: 'keyed', scope: 'root', keyProps: {} });

const effects = [];
const injectionCalls = [];
/** ctx.inject：起子 fiber 的官方形态（本模拟内同步回调+dotted 读取合法环境）。 */
const clientCtx = {
	slots,
	configForms,
	remote,
	effect(callback, label) {
		const cleanup = callback();
		effects.push({ label, cleanup });
		return cleanup;
	},
	inject(names, callback) {
		const dotted = names[0] === 'remote.ocgo-usage-dock';
		check('ctx.inject 请求的命名空间为 remote.ocgo-usage-dock（合法读的子 fiber）', dotted);
		// 模拟 dispatch 门控：异步回调，ctx 里 dotted 命名空间可读（本模拟直接给）
		return new Promise((resolve) => {
			const nsCtx = {
				remote: { 'ocgo-usage-dock': remoteServer },
			};
			callback(nsCtx);
			resolve(() => {});
		});
	},
};

const pluginFace = record.factory(requireStub);
check('face 有 apply 与 fiber inject', typeof pluginFace?.apply === 'function' && JSON.stringify(pluginFace?.inject) === JSON.stringify(['slots', 'configForms', 'remote']));

pluginFace.apply(clientCtx);

check('$mount 捕获一份贡献', contributions.length === 1);
const contribution = contributions[0];
check('贡献 package = 包名', contribution?.package === '@hmilyld/dsh-ocgo-usage-dock');
check(
	'贡献三 direct 方法（fetch/fetchCached/invalidate）',
	JSON.stringify((contribution.descriptors ?? []).map((d) => d.method).sort()) === JSON.stringify(['fetch', 'fetchCached', 'invalidate'])
);
check('贡献命名空间 = NS', (contribution.descriptors ?? []).every((d) => d.namespace === 'ocgo-usage-dock'));

const dockEntries = slotCore.entries('conversation.composer.dock');
check(
	'dock entry（id=NS, order=10）',
	dockEntries.length === 1 && dockEntries[0].options.id === 'ocgo-usage-dock' && dockEntries[0].options.order === 10
);
const dockInject = dockEntries[0]?.inject?.() ?? {};
check('dock inject face 暴露 ocko（initial/refresh/openSettings）', typeof dockInject.ocko?.initial === 'function' && typeof dockInject.ocko?.refresh === 'function' && typeof dockInject.ocko?.openSettings === 'function');

// 设置面板分区已按“统一入口”移除：设置面板不再有本插件导航行
check(
	'settings.section 无本插件导航行（统一入口＝插件页配置卡）',
	slotCore.entries('settings.section').length === 0
);

const keyedEntries = slotCore.entries('plugins.bundle.config');
check(
	'plugins.bundle.config keyed 卡（键 = 包名）',
	keyedEntries.length === 1 && keyedEntries[0].options.key === '@hmilyld/dsh-ocgo-usage-dock'
);
/** 供第 7 步复用（卸载步骤清 ledger 前先抓组件引用）。 */
const keyedComponentRef = keyedEntries[0]?.component ?? null;

/* ---------- 5. 可逆性：全部登记的极快卸载 ---------- */

for (const { cleanup } of effects) {
	await cleanup;
}
for (const stop of slotInventory.values()) {
	stop();
}
check('卸载后 dock/keyed 卡从 ledger 消失（settings.section 本就无占用）', slotCore.entries('conversation.composer.dock').length === 0 && slotCore.entries('plugins.bundle.config').length === 0);

/* ---------- 6. 组件 SSR 语义 ---------- */

const reactDomSSR = await import('react-dom/server');
const reactCore = reactModule;
const UsageDock = dockEntries[0]?.component;

// 6a. UsageDock 初载：行内只渲染隐形锚（真条本体走 portal、SSR 不构建容器）
const dockHtml = await reactDomSSR.renderToStaticMarkup(reactCore.createElement(UsageDock, { sessionId: 'x', ocko: dockInject.ocko }));
check(
	'UsageDock 初载 SSR 只剩隐形锚（无条本体/无占位/无错误）',
	dockHtml.includes('data-ocgo-anchor') && !dockHtml.includes('5h') && !dockHtml.includes('重试') && !dockHtml.includes('OpenCode Go'),
	dockHtml.slice(0, 120)
);

/* ---------- 7. Plugins 页 keyed 卡：owner 不给 form 时的自给路径 ---------- */

const PluginsPageCardComponent = keyedComponentRef;
if (PluginsPageCardComponent !== null) {
	const pageInject = { describe: describeFace, formController: configFormsState.form };
	slots.register(
		{ name: 'plugins.bundle.config', key: '@hmilyld/dsh-ocgo-usage-dock', inject: () => pageInject },
		PluginsPageCardComponent
	);
	const keyedEntry = slotCore.entries('plugins.bundle.config').at(-1);
	const keyedInject = keyedEntry?.inject?.() ?? {};
	// 自给形态：owner 无 form → 使用 configForms 控制器快照
	// 7a. 未 ready 时显示“加载中…”
	configFormsState.status = 'loading';
	configFormsState.value = undefined;
	const loadingPpHtml = await reactDomSSR.renderToStaticMarkup(reactCore.createElement(PluginsPageCardComponent, { view: 'page', ...keyedInject }));
	check('plugins 页卡未 ready 显示加载中', loadingPpHtml.includes('加载中'), loadingPpHtml.slice(0, 120));
	// 7b. ready 后直接渲染完整表单（不再等 owner 提供 form）
	configFormsState.ready();
	const selfServeHtml = await reactDomSSR.renderToStaticMarkup(reactCore.createElement(PluginsPageCardComponent, { view: 'page', ...keyedInject }));
	check('plugins 页卡自给渲染并显示四字段', /API Key/.test(selfServeHtml) && /刷新间隔/.test(selfServeHtml) && !/等待页面提供配置句柄/.test(selfServeHtml), selfServeHtml.slice(0, 140));
	const summaryHtml = await reactDomSSR.renderToStaticMarkup(reactCore.createElement(PluginsPageCardComponent, { view: 'summary', ...keyedInject }));
	check('plugins 页卡 summary 视图（一句话 + 无表单）', summaryHtml.includes('⟳') && !/API Key/.test(summaryHtml));
}

if (failed > 0) {
	console.error(`\n${failed} check(s) failed`);
	process.exitCode = 1;
} else {
	console.log('\nsimulate-client: all checks passed');
}
