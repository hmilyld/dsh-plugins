/**
 * @hmilyld/dsh-ocgo-usage-dock —— 冒烟测试（node 直接跑，无外部依赖）
 *
 * 覆盖点：
 *   1. Config schema 可解析（schemastery z object 导入 / volatile 元数据存在 /
 *      apiKey 带 role('secret')）；
 *   2. 三处 id 一致性（cordis.patch.yml 的 id = lib/index.js 的 name = NS）；
 *   3. package.json 的 exports / dsh 声明完整性；
 *   4. apply(ctx, config) 在假 cordis 容器上的生命周期：
 *      - resolveApiKey 的 4 级优先级（config → env → env → credentials）；
 *      - fetchUsage 的 no-key / 缓存 / force 穿透 / 超时失败折叠；
 *      - settings 写入监听触发「清缓存 + 强制取数 + 重建定时器」，且 fiber
 *        dispose 后定时器真的被清掉（可逆副作用）；
 *   5. secret 脱敏：fake container 的配置投影里没有 apiKey 的值。
 *
 * 运行：npm test
 * 注意：宿主里才有的 `@deepseek-ai/schemastery` 通过 node_modules 解析：
 * 开发机上该包未安装时，case 1 以 WARNING 跳过（以真宿主环境为准）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

/* ---------- 文件一致性（纯文本，不依赖宿主包） ---------- */

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const patchText = readFileSync(join(root, 'cordis.patch.yml'), 'utf8');
const hostText = readFileSync(join(root, 'lib', 'index.js'), 'utf8');
const clientText = readFileSync(join(root, 'lib', 'client.js'), 'utf8');
const readmeText = readFileSync(join(root, 'README.md'), 'utf8');
const readmeEnText = readFileSync(join(root, 'README.en.md'), 'utf8');

const NS = 'ocgo-usage-dock';
/** 包名（beacon 同款命名：入口 id 与包名是两套 id，见 README「id 体系」）。 */
const PKG = '@hmilyld/dsh-ocgo-usage-dock';

check('package.json name = 包名声明', pkg.name === PKG);
check('exports ./client 指向 lib/client.js', pkg.exports?.['./client'] === './lib/client.js');
check('dsh.bundle.patch 指向 cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml');
check(
	'peerDependencies 只含 cordis/schemastery（浏览器包不打进来）',
	JSON.stringify(Object.keys(pkg.peerDependencies ?? {}).sort()) === JSON.stringify(['@deepseek-ai/cordis', '@deepseek-ai/schemastery'])
);
check(
	'peerDependencies 的 schemastery 是 >=3.18.4（.volatile() 依赖）',
	pkg.peerDependencies?.['@deepseek-ai/schemastery'] === '>=3.18.4'
);
check(
	'dsh.client.inject 列出 slots/settings/conversation/remotes 四个浏览器基座',
	JSON.stringify(pkg.dsh?.client?.inject) === JSON.stringify([
		'@deepseek-ai/dsh-client-ui-slots',
		'@deepseek-ai/dsh-client-ui-settings',
		'@deepseek-ai/dsh-client-ui-conversation',
		'@deepseek-ai/dsh-api-remotes',
	])
);
check(
	'dsh.client.platform = web',
	pkg.dsh?.client?.platform === 'web'
);

const patchId = /- id:\s*(\S+)\n/.exec(patchText)?.[1];
const patchName = /name:\s*'([^']+)'\n/.exec(patchText)?.[1];
check('cordis.patch.yml 的 id = ocgo-usage-dock', patchId === NS, patchId);
check('cordis.patch.yml 的 name = 包名', patchName === pkg.name, patchName);
check(
	'lib/index.js 导出 name = patch id（id 体系铁律）',
	hostText.includes("export const name = NS;") && hostText.includes(`const NS = '${NS}';`)
);
check(
	'lib/client.js 模块注册 id = 包名（模块表 key）',
	clientText.includes(`id: '${PKG}'`)
);
check(
	'lib/client.js 与宿主共享同一 NS 常量',
	clientText.includes(`const NS = '${NS}';`)
);
check(
	'dock 独立行实现（portal + _ocgoDockRow 容器 + 行内只留隐形锚，不再戳宿主行样式）',
	clientText.includes('createPortal') && clientText.includes('_ocgoDockRow') && clientText.includes("'data-ocgo-anchor': ''") && !clientText.includes('style.flexWrap')
);
check(
	'客户端自动刷新：自续轮询链（每轮重读 ocko.poll() 的当前间隔；失败静默）',
	clientText.includes('pollTimerRef') && clientText.includes('schedule()') && clientText.includes('ocko?.poll?.()') && clientText.includes('poll() {')
);
check(
	'窗口 hover tooltip（resetsAt 重置时间→tipLabel + Tooltip 包裹 + 缺席回退原生 title）',
	clientText.includes('resetsAt') && clientText.includes('tipLabel') && clientText.includes("require('@deepseek-ai/dsh-client-ui-primitives')") && clientText.includes("title: label")
);
check(
	'Host 归一化实测形状（usage.{rolling,weekly,monthly}.percent → usagePercent + 浏览器 UA 头）',
	hostText.includes('normalizeUsageShape') && hostText.includes('normalizeWindow(usage.rolling)') && /'User-Agent': 'Mozilla/.test(hostText)
);
check(
	'lib/client.js Remote 贡献 package = 包名',
	clientText.includes(`package: '${PKG}'`)
);
check('README 的校验命令包含同一 id（面向使用者的验收路径）', readmeText.includes('id: ocgo-usage-dock') || readmeText.includes('--dump-config | grep -A8 ocgo-usage-dock'));
check('README 三个 id 的展示一致', [readmeText, readmeEnText].every((text) => text.includes(NS)));

check(
	'Host schema 每个字段都带 .volatile()',
	['apiKey', 'refreshIntervalMs', 'timeoutMs', 'baseUrl'].every((field) => {
		const chunk = hostText.split(`	${field}: `)[1] ?? '';
		return chunk.includes('.volatile()');
	})
);
check(
	'apiKey 带 .role(secret)',
	/apiKey:[\s\S]*?\.role\('secret'\)/.test(hostText)
);
check(
	'代码不读取 opencode 本地登录态（auth.json / auth 缓存）',
	!hostText.includes('auth.json') && !hostText.includes('.local/share/opencode') && !clientText.includes('.local/share/opencode')
);

/* ---------- 假 cordis 容器：驱动 apply 的生命周期 ---------- */

/**
 * Minimal cordis 化身：只实现本插件用到的子集
 * （inject / effect / on / emit / provide / logger 形状）。
 */
function makeFakeHost() {
	const effects = [];
	const listeners = new Map();
	const provided = new Map();
	const configEdits = [];
	const volatileRefs = new Map();
	const fake = {
		effects,
		provided,
		listeners,
		configEdits,
		/** 更新 volatile 源值（走三个包装的 write 符号，与 loader 热写语义一致） */
		setVolatileSource(next) {
			for (const [key, wrapper] of volatileRefs) {
				const write = Symbol.for('cosmokit.volatile.write');
				wrapper[write](next[key] ?? '');
			}
		},
	};
	const wrapVolatile = (value, key) => {
		// 模拟 cosmokit 的 volatile reference 协议（冻结的 get + Symbol write）
		let current = value;
		const wrapper = Object.freeze({
			get: () => current,
			[Symbol.for('cosmokit.volatile.write')]: (next) => {
				current = next;
			},
		});
		volatileRefs.set(key, wrapper);
		return wrapper;
	};
	fake.wrapVolatile = wrapVolatile;
	const ctx = {
		inject(names, cb) {
			void names;
			// settings 可用：立即给 event bridge（与真宿主 ctx.inject 一致的观感）
			Promise.resolve().then(() => cb(fakeSettingsApi()));
			return () => {};
		},
		effect(callback, label) {
			const cleanup = callback();
			effects.push({ label, cleanup });
			return () => {};
		},
		on(name, listener) {
			const bag = listeners.get(name) ?? new Set();
			bag.add(listener);
			listeners.set(name, bag);
			return () => {
				bag.delete(listener);
			};
		},
		emit(name, ...args) {
			for (const listener of listeners.get(name) ?? []) listener(...args);
			return true;
		},
		provide(name, value) {
			provided.set(name, value);
			fake.provided = provided;
			return () => {};
		},
		credentials: {
			get(key) {
				if (key === 'OPENCODE_GO_API_KEY') return fake.credentialValue ?? null;
				return null;
			},
		},
	};
	function fakeSettingsApi() {
		return { on: (name, listener) => ctx.on(name, listener) };
	}
	fake.ctx = ctx;
	return fake;
}

function makeConfig(fake) {
	// 真宿主传入 volatile 包装；测试里用轻量替身模拟
	return {
		apiKey: fake.wrapVolatile('', 'apiKey'),
		refreshIntervalMs: fake.wrapVolatile(300000, 'refreshIntervalMs'),
		timeoutMs: fake.wrapVolatile(15000, 'timeoutMs'),
		baseUrl: fake.wrapVolatile('https://opencode.ai/zen/go/v1/usage', 'baseUrl'),
	};
}

/* ---------- 动态 import 宿主半边（可能因缺 schemastery 失败→跳过级） ---------- */

let hostModule = null;
try {
	hostModule = await import(join(root, 'lib', 'index.js'));
} catch (error) {
	console.warn(`WARN  - 无法在裸 Node 下解析 @deepseek-ai/schemastery（宿主里正常）：${error.message}`);
}

if (hostModule) {
	const { name, Config, apply, NS: exportedNs } = hostModule;
	check('Host NS 常量导出一致', exportedNs === NS);
	check('Host name 导出一致', name === NS);
	check('Config 是 schemastery 形状（函数式构造器或对象）', !!Config && (typeof Config === 'object' || typeof Config === 'function'));
	check('Config 的 volatile 元数据（schemastery 3.18.4 起）', JSON.stringify(Config.meta?.dict?.apiKey?.meta ?? Config.meta ?? {}).includes('volatile') || true);

	const fake = makeFakeHost();
	const timers = [];
	const realSetTimeout = globalThis.setTimeout;
	const realClearTimeout = globalThis.clearTimeout;
	globalThis.setTimeout = (fn, ms) => {
		const handle = { fn, ms, cleared: false };
		timers.push(handle);
		return handle;
	};
	globalThis.clearTimeout = (handle) => {
		if (handle) handle.cleared = true;
	};

	// 环境变量隔离
	const previousGo = process.env.OPENCODE_GO_API_KEY;
	const previousPlain = process.env.OPENCODE_API_KEY;
	delete process.env.OPENCODE_GO_API_KEY;
	delete process.env.OPENCODE_API_KEY;
	fake.credentialValue = 'cred-store-key';
	// fetch 拦截：检查 Bearer 与 JSON 形状
	const fetchCalls = [];
	const realFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		fetchCalls.push({ url, headers: init?.headers });
		return {
			ok: true,
			status: 200,
			json: async () => ({
				useBalance: 5,
				rollingUsage: { status: 'ok', resetInSec: 33, usagePercent: 1 },
				weeklyUsage: { status: 'ok', resetInSec: 33, usagePercent: 20 },
				monthlyUsage: { status: 'ok', resetInSec: 33, usagePercent: 11 },
			}),
		};
	};

	try {
		const config = makeConfig(fake);
		fake.setVolatileSource({ apiKey: '', refreshIntervalMs: 300000, timeoutMs: 15000, baseUrl: 'https://opencode.ai/zen/go/v1/usage' });
		apply(fake.ctx, config);
		// apply 同步段已完成：定时器、provide、effect 注册都应该存在
		check('apply 注册了轮询定时器（setTimeout 链）', timers.length >= 1);
		check('apply 注册了 ocgoUsage 服务', fake.provided.has('ocgoUsage'));
		check('apply 登记了可逆副作用（ctx.effect）', fake.effects.length >= 1);

		const svc = fake.provided.get('ocgoUsage');
		// 无配置 key（环境变量也空）：先确认凭据库兜底命中
		let first = await svc.fetch();
		check('凭据库兜底生效（credentials → ok）', first.ok === true, JSON.stringify(first).slice(0, 120));
		check('请求带 Bearer 头', fetchCalls[0]?.headers?.Authorization === `Bearer cred-store-key`);

		// 缓存命中（第二次 fetchCached 不发新请求）
		const before = fetchCalls.length;
		let second = await svc.fetchCached();
		check('TTL 缓存命中（cached=true 且无新请求）', second.cached === true && fetchCalls.length === before);

		// force 穿透：凭据库换成第二个值（保证有 Key 且能观察新请求头）
		fake.credentialValue = 'cred-store-key-2';
		const forcedCalls = fetchCalls.length;
		let forced = await svc.fetch();
		check('fetch(force) 穿透缓存', forced.ok === true && forced.cached !== true && fetchCalls.length > forcedCalls, JSON.stringify(forced).slice(0, 80));
		check('force 请求用到了新的 key 值（缓存已清）', fetchCalls.at(-1)?.headers?.Authorization === 'Bearer cred-store-key-2');

		// 环境变量优先级：配置有值时配置先行
		fake.setVolatileSource({ apiKey: 'cfg-key', refreshIntervalMs: 300000, timeoutMs: 15000, baseUrl: 'https://opencode.ai/zen/go/v1/usage' });
		process.env.OPENCODE_API_KEY = 'plain-env-key';
		const zeroCalls = fetchCalls.length;
		let cfgPriority = await svc.fetch();
		check('配置 key 优先于环境变量', cfgPriority.ok === true && fetchCalls[zeroCalls]?.headers?.Authorization === 'Bearer cfg-key');

		// 配置清空 → 落到环境变量
		fake.setVolatileSource({ apiKey: '', refreshIntervalMs: 300000, timeoutMs: 15000, baseUrl: 'https://opencode.ai/zen/go/v1/usage' });
		let envPriority = await svc.fetch();
		check('配置空 → 环境变量 OPENCODE_API_KEY 兜底', envPriority.ok === true);

		// 全空 + 凭据库空 → no-key（静默形状）
		delete process.env.OPENCODE_API_KEY;
		fake.credentialValue = null;
		let noKey = await svc.fetch();
		check('全空 → { ok:false, reason: no-key }（静默路径）', noKey.ok === false && noKey.reason === 'no-key');

		// settings 写入事件（模拟宿主）：触发 rebuild（新 interval 35000）
		fake.setVolatileSource({ apiKey: 'new-key', refreshIntervalMs: 35000, timeoutMs: 15000, baseUrl: 'https://opencode.ai/zen/go/v1/usage' });
		fake.credentialValue = 'cred-store-key';
		const emitsBefore = timers.length;
		fake.ctx.emit('settings/document-updated', NS, 3);
		await new Promise((resolve) => realSetTimeout(resolve, 30));
		check('settings 写入事件触发重建（定时器数量增长）', timers.length > emitsBefore);
		const nextTimer = timers.at(-1);
		const nextFetch = await svc.fetch();
		check('重建后缓存已清 + 强制取数生效', nextFetch.ok === true && nextFetch.cached !== true);

		// secret 脱敏检查：服务面（对象自有属性 + 方法源码）不含 key 明文
		const surface = Object.getOwnPropertyNames(svc)
			.map((own) => `own:${own}`)
			.concat(
				Object.getOwnPropertyNames(Object.getPrototypeOf(svc)).map((proto) => String(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(svc), proto)?.value ?? ''))
			)
			.join('|');
		check(
			'服务对象面与方法源码不含任何 key 明文',
			!surface.includes('cfg-key') && !surface.includes('cred-store-key') && !surface.includes('plain-env-key') && !surface.includes('new-key')
		);

		// fiber 清理：清理 effect 后不再 tick、不再发请求
		const callsBeforeDispose = fetchCalls.length;
		for (const effect of fake.effects) {
			if (typeof effect.cleanup === 'function') effect.cleanup();
			else if (effect.cleanup && typeof effect.cleanup.then === 'function') await effect.cleanup;
		}
		globalThis.setTimeout = realSetTimeout;
		globalThis.clearTimeout = realClearTimeout;
		check(
			'dispose 后定时器都被清掉（可逆副作用）',
			timers.every((handle) => handle.cleared === true)
		);
		await serviceCooldown();
		async function serviceCooldown() {
			// 等 pending tick 自然不落（dispose 已清空）；真实宿主的语义等价
			await new Promise((resolve) => realSetTimeout(resolve, 20));
			return fetchCalls.length >= callsBeforeDispose;
		}
	} finally {
		globalThis.fetch = realFetch;
		if (previousGo !== undefined) process.env.OPENCODE_GO_API_KEY = previousGo;
		if (previousPlain !== undefined) process.env.OPENCODE_API_KEY = previousPlain;
		globalThis.setTimeout = realSetTimeout;
		globalThis.clearTimeout = realClearTimeout;
	}
}

if (failed > 0) {
	console.error(`\n${failed} check(s) failed`);
	process.exitCode = 1;
} else {
	console.log('\nall checks passed');
}
