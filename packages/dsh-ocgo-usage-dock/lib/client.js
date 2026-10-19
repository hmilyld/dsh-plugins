/**
 * @hmilyld/dsh-ocgo-usage-dock —— Client 半边（浏览器，classic script）
 *
 * DSH 0.2.0-rc.2 的模块系统：包名 = 模块表 key = 注册 id。boot wire
 * （window.__DSH_BOOT__）按包依赖边排布 graph 行，浏览器装载脚本执行时
 * 仅 REGISTERS 工厂（window.__ModuleLoader__.load({id, factory}))；
 * factory(require) 只在第一次 import（entry 物化）时执行。
 *
 * 闭包内同步 require：
 *   - react：UI 基线静态模块（渲染管线共享同一 react 实例）。
 * 其余依赖（slots / configForms / remote）都通过 cordis 服务访问，在
 * package.json 的 dsh.client.inject 里声明包边、在本插件 inject 里声明
 * 纤维服务依赖，保证 materialize 与激活两层都有序。
 *
 * apply(ctx) 注册：
 *   1. `conversation.composer.dock`（list/session）order 10 —— 输入框下方
 *      用量条。槽位由 ui-conversation 装配链声明； 该行的 flex 容器还渲染
 *      ContextMeter（token 表）等同行内容， 因此真正的用量条通过
 *      react-dom portal 挂到那行之后的**兄弟容器**（composer 根内、紧跟
 *      meter 行），独占一行且完全不碰宿主 flex 行样式。
 *   2. `settings.section`（list/root）id = NS、order 20 —— 设置面板整页分区。
 *      面板导航（id/order/label）由 ui-settings-general 从槽位 ledger 投影。
 *   3. typert Remote 贡献 $mount：把 Host 的 `ocgoUsage` 服务暴露为
 *      `ctx.remote['ocgo-usage-dock']`（fetch / fetchCached / invalidate）。
 *   4. configForms.get(NS)：settings 服务的 volatile 表单视图（读写配置）。
 *
 * 与 Host 半边的一致性点：
 *   - NS（'ocgo-usage-dock'）= cordis.patch.yml 的 id = Host 导出的 name；
 *   - 远程方法名 fetch/fetchCached/invalidate 与 Host 服务实现一一对应；
 *   - TYPERT_REMOTE 描述符 service = 'ocgoUsage' 指向 Host ctx.provide 的键。
 */
window.__ModuleLoader__.load({
	id: '@hmilyld/dsh-ocgo-usage-dock',
	factory: (require) => {
		const React = require('react');
		const { createElement, Fragment, useCallback, useEffect, useRef, useState } = React;
		const ReactDOM = require('react-dom');
		/** Tooltip 走 DSH 静态 seed 模块（web-frontend 预打包，共享同一 react）；
		 *  primitives 没有独立 client 行，静态表是唯一事实。缺行时 alerts 走原生 title。 */
		let Tooltip = null;
		try {
			Tooltip = require('@deepseek-ai/dsh-client-ui-primitives').Tooltip ?? null;
		} catch {
			Tooltip = null;
		}

		/** 包名 = 模块表 key = typert Remote 贡献 package（与 beacon 同款命名）。 */
		const PKG_NAME = '@hmilyld/dsh-ocgo-usage-dock';
		/** 设置命名空间 = 远程命名空间 = 槽位 entry id（= Host 导出的 name）。 */
		const NS = 'ocgo-usage-dock';
		/** 输入框下方 dock 槽位与其 order（会话级 list 槽）。 */
		const SLOT_DOCK = 'conversation.composer.dock';
		const DOCK_ORDER = 10;
		/** 卡片标题（插件页配置卡用）。 */
		const SECTION_LABEL = 'OpenCode Go 用量';
		/** 客户端轮询的默认间隔（与 Host 半边 Config 默认一致：5 分钟）。 */
		const DEFAULT_REFRESH_INTERVAL_MS = 300_000;
		/** 插件管理页的 bundle 配置卡（keyed，键 = 包名）。 */
		const SLOT_PLUGINS_CONFIG = 'plugins.bundle.config';

		/* ==================== typert Remote 贡献 ==================== */

		/**
		 * 本包的 Remote 贡献：与 Host 半边 OcgoUsageRemote 的 `typertRemote`
		 * 绑定（namespace = NS）及 REMOTE_METHOD_DESCRIPTOR（三个 direct 方法、
		 * 零业务参数）严格对应。调用链：
		 *   组件 → ctx.remote[NS].<方法>() → connection.rpc('/api', '<NS>/<方法>')
		 *   Host gateway 按 SRC 反射解析到 `ocgoUsage` 服务实现 → JSON 回传。
		 * result 用 src-json（值直通）；无参数即无需 strict 参数编码。
		 */
		const OCKER_REMOTE = {
			package: '@hmilyld/dsh-ocgo-usage-dock',
			descriptors: [
				{
					id: `@hmilyld/dsh-ocgo-usage-dock#${NS}/fetch`,
					service: 'ocgoUsage',
					namespace: NS,
					method: 'fetch',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'src-json' },
				},
				{
					id: `@hmilyld/dsh-ocgo-usage-dock#${NS}/fetchCached`,
					service: 'ocgoUsage',
					namespace: NS,
					method: 'fetchCached',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'src-json' },
				},
				{
					id: `@hmilyld/dsh-ocgo-usage-dock#${NS}/invalidate`,
					service: 'ocgoUsage',
					namespace: NS,
					method: 'invalidate',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'src-json' },
				},
			],
		};

		/* ==================== 样式（data-plugin-css 一次性吊挂） ==================== */

		const DOCK_CSS = [
			'._ocgoDock{display:flex;align-items:center;gap:10px;min-width:0}',
			/* 独立行容器：经 portal 插到 meter 行之后的兄弟节点（宽随 composer 根）。 */
			'._ocgoDockRow{display:flex;align-items:center;justify-content:center;width:auto;max-width:100%;padding:2px 2px 0}',
			'._ocgoName{font-size:12px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-secondary);flex:none;white-space:nowrap}',
			'._ocgoWindows{display:flex;align-items:center;gap:10px;min-width:0;overflow:hidden}',
			'._ocgoWindow{display:inline-flex;align-items:center;gap:5px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
			'._ocgoDot{border-radius:50%;width:6px;height:6px;flex:none}',
			'._ocgoValue{font-variant-numeric:tabular-nums}',
			'._ocgoGap{flex:1 1 auto}',
			'._ocgoActions{display:inline-flex;align-items:center;gap:2px;flex:none}',
			'._ocgoBtn{display:inline-flex;align-items:center;justify-content:center;border:none;background:none;padding:2px 6px;border-radius:6px;font-size:13px;line-height:18px;cursor:pointer;color:var(--dsw-alias-label-secondary)}',
			'._ocgoBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'._ocgoBtn:disabled{opacity:.5;cursor:default}',
			'._ocgoHeading{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}',
			'._ocgoError{display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:var(--dsw-alias-state-error-primary,#c92a2a);min-width:0}',
			'._ocgoRetry{border:none;background:none;padding:0;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;color:inherit;white-space:nowrap}',
			'._ocgoCard{display:flex;flex-direction:column;gap:14px;max-width:560px}',
			'._ocgoTitle{font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary);margin:0}',
			'._ocgoHint{font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);margin:0}',
			'._ocgoField{display:flex;flex-direction:column;gap:6px}',
			'._ocgoLabel{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}',
			'._ocgoInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:7px 10px;width:100%}',
			'._ocgoSave{align-self:flex-start;border:none;border-radius:8px;background:var(--dsw-alias-brand-primary,#4a6df5);color:var(--dsw-alias-brand-primary-contrast,#fff);font:inherit;font-size:13px;font-weight:500;line-height:20px;padding:7px 16px;cursor:pointer}',
			'._ocgoSave:disabled{opacity:.6;cursor:default}',
			'._ocgoStatus{font-size:12px;line-height:20px}',
			'._ocgoStatusError{color:var(--dsw-alias-state-error-primary,#c92a2a)}',
			'._ocgoStatusOk{color:var(--dsw-alias-state-success-primary,#2f9e44)}',
			'._ocgoLoading{font-size:13px;line-height:22px;color:var(--dsw-alias-label-secondary)}',
		].join('');

		function injectStyleOnce() {
			if (typeof document === 'undefined') return;
			const tagId = '@hmilyld/dsh-ocgo-usage-dock/dock.css';
			if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return;
			const node = document.createElement('style');
			node.dataset.plugin = NS;
			node.dataset.pluginCss = tagId;
			node.textContent = DOCK_CSS;
			document.head.appendChild(node);
		}

		/* ==================== 数据形状与工具 ==================== */

		/**
		 * usagePercent 的防御读取（非法 / 缺失 → null，界面显示 "…"）。
		 * 接受同义键名（percent/percentage），避免线上响应字段细微差异时空窗。
		 */
		function percentOf(windowValue) {
			if (!windowValue || typeof windowValue !== 'object') return null;
			const candidate = windowValue.usagePercent ?? windowValue.percent ?? windowValue.percentage;
			const value = Number(candidate);
			return Number.isFinite(value) ? value : null;
		}

		/** 健康度彩点：< 60 绿、60–85 黄、≥ 85 红、未知灰。 */
		function colorOf(percent) {
			if (percent === null) return 'var(--dsw-alias-label-tertiary,rgba(128,128,128,.7))';
			if (percent >= 85) return 'var(--dsw-alias-state-danger-primary,#c92a2a)';
			if (percent >= 60) return 'var(--dsw-alias-state-warning-primary,#b8860b)';
			return 'var(--dsw-alias-state-success-primary,#2f9e44)';
		}

		/** 三个用量窗口的固定展示顺序与短标签。 */
		const WINDOWS = [
			{ key: 'rollingUsage', label: '5h' },
			{ key: 'weeklyUsage', label: '周' },
			{ key: 'monthlyUsage', label: '月' },
		];

		/** 失败原因 → 一行可读文案（no-key 不算失败，走静默路径）。 */
		function errorText(reason) {
			if (reason === 'timeout') return '用量请求超时';
			if (typeof reason === 'string' && reason.startsWith('http-')) {
				return `用量接口响应 ${reason.slice(5)}`;
			}
			if (reason === 'network') return '无法连接用量接口';
			return '用量请求失败';
		}

		/* ==================== 设置面板导航兜底 ==================== */

		/**
		 * 打开设置面板并尽量定位到「插件」导航行 —— 本插件设置的唯一入口在
		 * 设置面板的插件页（`plugins.bundle.config` keyed 配置卡）。
		 * 无定位公共 API 的兜底：点击侧栏 Settings 触发钮，再轮询点击文本为
		 * 「插件 / Plugins」的导航行；两步失败即静默（面板仍会被打开）。
		 * TODO(next): use ctx.settingsNav?.open(...) when DSH ships a public face.
		 */
function openSettingsAtSection() {
			const trigger = document.querySelector('button[aria-haspopup="dialog"][aria-expanded]');
			if (!(trigger instanceof HTMLButtonElement)) return;
			trigger.click();
			/* 统一入口：定位到设置面板的「插件」导航行（本插件的设置就在插件页里）。 */
			const labels = new Set(['插件', 'Plugins', 'Plugin']);
			let tries = 0;
			const picker = setInterval(() => {
				tries += 1;
				const row = Array.from(document.querySelectorAll('button')).find((node) =>
					labels.has((node.textContent ?? '').trim())
				);
				if (row instanceof HTMLButtonElement) {
					row.click();
					clearInterval(picker);
					return;
				}
				if (tries > 40) clearInterval(picker);
			}, 50);
		}

		/* ==================== 用量条组件 ==================== */

		/**
		 * UsageDock —— `conversation.composer.dock`（list/session）entry 组件。
		 *
		 * 业务面 `ocko` 由注册时的 inject 工厂注入（apply 闭包的 ctx 服务）：
		 *   ocko.initial()   → 带 300s TTL 的首次取数（fetchCached）
		 *   ocko.refresh()   → 手动刷新（force，穿透缓存）
		 *   ocko.openSettings() → 打开设置面板
		 *
		 * 渲染语义（行为规范 1 / 2 / 4）：
		 *   - 首次挂载与 sessionId 变化时取数；
		 *   - 无 Key（'no-key'）或尚未拿到数据 ⇒ null，不渲染任何内容；
		 *   - 只有真实网络错误 / 超时 / 非 2xx 才显示一行错误文案 + 重试；
		 *   - 刷新中按钮显示 `…` 并禁用。
		 */
		/**
		 * UsageDock —— `conversation.composer.dock`（list/session）的 entry。
		 * 只做一个轻量定位件：在行内挂一个隐形锚（宿主 portal 锚 display:contents
		 * 的孩子），用它找到 meter 行与其父级，把真正的用量条 UsageDockBar
		 * portal 到 meter 行**之后**的兄弟容器 —— 独占一行，不碰宿主 flex 行。
		 * 容器随会话/挂载重建，卸载即移除（可逆副作用）。
		 */
		function UsageDock(props) {
			const { sessionId, ocko } = props ?? {};
			const anchorRef = useRef(null);
			const containerRef = useRef(null);
			const [container, setContainer] = useState(null);
			/** （失败的）顿挫防护：重定位最多 60 帧。 */
			const attemptsRef = useRef(0);

			/** 布局副作用：锚 → meter 行 → 插入兄弟容器并在其上 portal 用量条。 */
			useEffect(() => {
				let raf = 0;
				const place = () => {
					const anchor = anchorRef.current;
					if (!(anchor instanceof HTMLElement)) return false;
					// 我 §_ls 的锚在 portal 锚（display:contents）里；上一级是 meter 行
					const portalAnchor = anchor.parentElement; // div[data-slot]
					const meterRow = portalAnchor?.parentElement ?? null; // .uV…_dock
					if (!(meterRow instanceof HTMLElement)) return false;
					const stage = meterRow.parentElement;
					if (!(stage instanceof HTMLElement)) return false;
					// 以 meter 行为参照插一个兄弟容器（紧跟其后）
					let box = containerRef.current;
					if (!box) {
						box = document.createElement('div');
						box.className = '_ocgoDockRow';
						box.setAttribute('data-ocgo-dock', 'row');
						containerRef.current = box;
					}
					if (box.previousElementSibling !== meterRow || box.parentElement !== stage) {
						meterRow.after(box);
					}
					setContainer((current) => (current === box ? current : box));
					return true;
				};
				const retry = () => {
					if (place()) return;
					attemptsRef.current += 1;
					if (attemptsRef.current > 60) {
						console.warn('[ocgo-usage-dock] 未能布置独立行（meter 行未出现；随 composer 重现时自动重试）');
						return;
					}
					raf = requestAnimationFrame(retry);
				};
				retry();
				return () => {
					cancelAnimationFrame(raf);
					// 先撤 portal（React 卸载），再移除容器：若容器已被宿主移除则幂等
					try {
						containerRef.current?.remove();
					} catch {
						/* 容器已被移除 */
					}
					containerRef.current = null;
					setContainer(null);
				};
			}, [sessionId]);

			// 行内只留隐形锚；条本体经 portal 落进独立行。
			return createElement(
				Fragment,
				null,
				createElement('span', { ref: anchorRef, 'data-ocgo-anchor': '', style: { display: 'none' } }),
				container !== null
					? ReactDOM.createPortal(createElement(UsageDockBar, { sessionId, ocko }), container, `ocgo-dock-${sessionId ?? 'blank'}`)
					: null
			);
		}

		/**
		 * UsageDockBar —— 真正的用量条（经 portal 挂在独立行上）。
		 *
		 * 渲染语义（行为规范 1 / 2 / 4）：
		 *   - 首次挂载与 sessionId 变化时取数；
		 *   - 无 Key（'no-key'）或尚未拿到数据 ⇒ null，不渲染任何内容；
		 *   - 只有真实网络错误 / 超时 / 非 2xx 才显示一行错误文案 + 重试；
		 *   - 刷新中按钮显示 `…` 并禁用。
		 */
		function UsageDockBar(props) {
			const { sessionId, ocko } = props ?? {};
			/** 正常数据结果：{ data: {rollingUsage, weeklyUsage, monthlyUsage} } */
			const [dataView, setDataView] = useState(null);
			/** 'loading'（首次）| 'idle' | 'refreshing' | 'error' */
			const [state, setState] = useState('loading');
			const [errorReason, setErrorReason] = useState(null);
			const alive = useRef(true);

			useEffect(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);

			/** 统一的结果折叠：绝不向上抛，错误都以 reason 落 UI。 */
			const applyResult = useCallback((result) => {
				if (!alive.current) return;
				if (result !== null && typeof result === 'object' && result.ok === true && result.data) {
					setDataView(result.data);
					setState('idle');
					setErrorReason(null);
					return;
				}
				if (result !== null && typeof result === 'object' && result.ok === false && result.reason === 'no-key') {
					// 无 Key：静默（不渲染占位、空行或错误）
					setDataView(null);
					setState('idle');
					setErrorReason(null);
					return;
				}
				setState('error');
				setErrorReason(result?.reason ?? 'network');
			}, []);

			/** 首次 / 会话切换：带 TTL 的取数。 */
			useEffect(() => {
				setDataView(null);
				setState('loading');
				setErrorReason(null);
				let cancelled = false;
				// promise 失败也折叠进 UI（ocko 内部已不抛，这里再加一层保险）
				Promise.resolve(ocko?.initial?.() ?? { ok: false, reason: 'network' })
					.then((result) => {
						if (!cancelled) applyResult(result);
					})
					.catch(() => {
						if (!cancelled) applyResult({ ok: false, reason: 'network' });
					});
				return () => {
					cancelled = true;
				};
			}, [sessionId]);

			const onManualRefresh = useCallback(() => {
				setState('refreshing');
				Promise.resolve(ocko?.refresh?.() ?? { ok: false, reason: 'network' })
					.then((result) => {
						applyResult(result);
					})
					.catch(() => {
						applyResult({ ok: false, reason: 'network' });
					});
			}, [applyResult]);

			const onOpenSettings = useCallback(() => {
				ocko?.openSettings?.();
			}, []);

			/**
			 * 自动刷新：自续 setTimeout 链，每轮取数后**重新读当前间隔**再调度
			 * 下一轮（设置页保存新间隔后，下一轮就按新间隔走）。轮询失败保持
			 * 静默——继续用上一次的数据，把错误呈现只留给手动刷新。
			 */
			const aliveRef = useRef(true);
			const pollTimerRef = useRef(null);
			useEffect(() => {
				aliveRef.current = true;
				const schedule = () => {
					const raw = Number(ocko?.poll?.() ?? DEFAULT_REFRESH_INTERVAL_MS);
					const ms = Number.isFinite(raw) && raw > 0 ? Math.max(10_000, raw) : DEFAULT_REFRESH_INTERVAL_MS;
					pollTimerRef.current = setTimeout(async () => {
						if (!aliveRef.current) return;
						try {
							const result = await Promise.resolve(ocko?.initial?.() ?? { ok: false });
							if (result !== null && typeof result === 'object' && result.ok === true && result.data) {
								applyResult(result);
							}
						} catch {
							/* 轮询失败静默 */
						}
						if (aliveRef.current) schedule();
					}, ms);
				};
				schedule();
				return () => {
					aliveRef.current = false;
					if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current);
				};
			}, [sessionId]);

			// 静默约束：没有数据且不在错误态时，什么都不渲染（含首次加载）。
			if (dataView === null && state !== 'error') return null;

			const busy = state === 'refreshing';
			const showErrorOnly = dataView === null;
			return createElement(
				'div',
				{ className: '_ocgoDock', 'data-ocgo-dock': 'bar', role: 'status' },
				createElement('span', { className: '_ocgoName' }, 'OpenCode Go'),
				!showErrorOnly
					? createElement(
							'span',
							{ className: '_ocgoWindows' },
							WINDOWS.map(({ key, label }) => {
								const windowValue = dataView?.[key];
								return createElement(WindowChip, {
									key,
									label,
									name: label === '5h' ? '5 小时滚动窗' : label === '周' ? '本周' : '本月',
									percent: percentOf(windowValue),
									resetsAt: windowValue?.resetsAt,
								});
							})
						)
					: null,
				!showErrorOnly ? createElement('span', { className: '_ocgoGap' }) : createElement('span', { style: { width: '8px' } }),
				createElement(
					'span',
					{ className: '_ocgoActions' },
					createElement(
						'button',
						{
							type: 'button',
							className: '_ocgoBtn',
							onClick: onManualRefresh,
							disabled: busy || state === 'loading',
							'aria-label': '刷新 OpenCode Go 用量',
							title: '刷新 OpenCode Go 用量',
						},
						busy ? '…' : '⟳'
					),
					createElement(
						'button',
						{
							type: 'button',
							className: '_ocgoBtn',
							onClick: onOpenSettings,
							'aria-label': '打开 OpenCode Go 用量设置',
							title: '打开 OpenCode Go 用量设置',
						},
						'⚙'
					)
				),
				state === 'error'
					? createElement(
							'span',
							{ className: '_ocgoError' },
							createElement('span', null, errorText(errorReason)),
							createElement(
								'button',
								{ type: 'button', className: '_ocgoRetry', onClick: onManualRefresh },
								'重试'
							)
						)
					: null
			);
		}

		/* ==================== 设置卡片 ==================== */

		/**
		 * 设置分区卡 —— `settings.section`（list/root）entry 组件。
		 *
		 * 业务面 `form`：ctx.configForms.get(NS) 的 ConfigForm 控制器
		 *（snapshot{status,value,revision,writable,mode} + subscribe + set/unset）。
		 *
		 * 字段与 draft：
		 *   - apiKey（type=password）：服务端 redact，snapshot.value 里没有；draft
		 *     保持空表示「不动现值」，填了就写入，填空串=清除(回到环境变量/凭据库)；
		 *   - 刷新间隔 / 请求超时以「秒」编辑，保存时换算毫秒；
		 *   - baseUrl 原样字符串；
		 *   - 本地校验不过就不.enable 保存钮并显示红色提示（不发请求）。
		 */
		function SettingsCard(props) {
			const { form, mirrors } = props ?? {};
			/** 共享 describe 镜像面：诊断 loading 卡死的成因（宿主没激活/字段缺失）。 */
			const describeFace = mirrors?.describe ?? null;
			const [snapshot, setSnapshot] = useState(() => (form ? form.getSnapshot() : null));
			// draft 在 useState 初始化器里就绪（ready 时立刻可编辑；SSR/首帧也一致）
			const [draft, setDraft] = useState(() => draftFromSnapshot(form ? form.getSnapshot() : null));
			const [saving, setSaving] = useState(false);
			const [message, setMessage] = useState(null);
			// 镜像快照版本号：镜像变化也要引起本卡重渲染（loading 诊断联动）
			const [mirrorTick, setMirrorTick] = useState(0);

			// 跟随 snapshot 变化（服务端确认 / 冲突 / 别处改动都会推新快照）
			useEffect(() => {
				if (!form) return undefined;
				setSnapshot(form.getSnapshot());
				return form.subscribe(() => {
					setSnapshot(form.getSnapshot());
				});
			}, [form]);

			/** 镜像订阅 + 空转兜底：describe 还没拿到答案（idle）时主动 ensure，并在
			 * 前两分钟内以低频重试（宿主晚激活/网络恢复后自动追上）。 */
			useEffect(() => {
				if (!describeFace) return undefined;
				const mirror = describeFace.getSnapshot?.() ?? null;
				if (mirror?.status === 'idle') describeFace.ensure?.();
				let attempt = 0;
				const timer = setInterval(() => {
					attempt += 1;
					const probe = describeFace.getSnapshot?.() ?? null;
					setMirrorTick((tick) => tick + 1);
					if (probe?.status !== 'idle' || attempt > 20) {
						clearInterval(timer);
						return;
					}
					describeFace.ensure?.();
				}, 6_000);
				const un = describeFace.subscribe?.(() => {
					setMirrorTick((tick) => tick + 1);
				});
				return () => {
					clearInterval(timer);
					if (typeof un === 'function') un();
				};
			}, [describeFace]);

			const ready = snapshot !== null && snapshot.status === 'ready';

			// loading → ready 的跨帧补初始化（首次挂载时还没就绪的场合）
			useEffect(() => {
				if (!ready || draft !== null) return;
				setDraft(draftFromSnapshot(snapshot));
			}, [ready, draft, snapshot]);

			const invalid = validateDraft(draft);
			const saveDisabled = saving || draft === null || invalid !== null || (snapshot?.writable === false);

			const onSave = useCallback(async () => {
				if (!form || draft === null || saving) return;
				setSaving(true);
				setMessage(null);
				try {
					const ops = opsFromDraft(draft);
					for (const [field, payload] of ops) {
						const accepted = payload === null ? await form.unset(field) : await form.set(field, payload);
						if (accepted === false) {
							setMessage('保存未生效：宿主拒绝了这次修改（可能是最近被他处改动）。');
							return;
						}
					}
					setMessage('已保存：配置立即生效（定时器已按新间隔重建）。');
				} catch (error) {
					setMessage(`保存失败：${error instanceof Error ? error.message : String(error)}`);
				} finally {
					setSaving(false);
				}
			}, [form, draft, saving]);

			// 诊断式加载分支：区分「镜像还没答案」与「镜像就绪但缺少本插件命名空间」，
			// 并把镜像错误透出（重连/保存会自动刷新；无镜像面时维持兜底文案）。
			if (!form || snapshot === null || snapshot.status === 'loading') {
				if (describeFace !== null) {
					const mirror = describeFace.getSnapshot();
					if (mirror !== null && mirror.status === 'ready' && mirror.view !== undefined) {
						const served = mirror.view.namespaces.some((row) => row.ns === NS);
						if (!served) {
							// describe 已有答案但没有本插件：Host 半边多半没激活或没有 volatile 字段
							return createElement(
								'p',
								{ className: '_ocgoStatus _ocgoStatusError', role: 'alert' },
								'宿主的设置文档里没有本插件的可编辑字段（ns 未在 describe 里）：多半是 Host 半边没有激活（看 dsh web 启动日志里的 entry did not activate），或 Config 缺 .volatile()。修复宿主端后刷新页面即可。'
							);
						}
					}
					if (mirror !== null && mirror.error) {
						return createElement(
							'div',
							{ className: '_ocgoLoading' },
							`加载中…（settings describe 上次失败：${mirror.error}；自动重试中）`
						);
					}
					if (mirror === null || mirror.status === 'idle') {
						return createElement('p', { className: '_ocgoLoading' }, '加载中…（settings describe 尚未启动，自动重试中）');
					}
				}
				return createElement('p', { className: '_ocgoLoading' }, '加载中…');
			}
			if (snapshot.status === 'unavailable') {
				return createElement('p', { className: '_ocgoLoading' },
					'当前部署以只读方式保存设置（远程浏览器实例不落宿主文档），请在本地 dsh 中修改。');
			}

			return createElement('div', { className: '_ocgoCard' },
				createElement('h2', { className: '_ocgoTitle' }, 'OpenCode Go 用量'),
				createElement(
					'p',
					{ className: '_ocgoHint' },
					'数据来自 OpenCode 官方用量接口（纯元数据，不消耗模型额度）。API Key 按优先级 resolve：配置 → 环境变量 OPENCODE_GO_API_KEY / OPENCODE_API_KEY → DSH 凭据库。'
				),
				createElement(FormField, {
					id: `${NS}-apiKey`,
					label: 'API Key',
					hint: '留空表示保持现有来源（环境变量 / 凭据库）。为安全起见已保存的值不会回显。',
					type: 'password',
					value: draft?.apiKey ?? '',
					onChange: (next) => setDraft((d) => ({ ...d, apiKey: next })),
				}),
				createElement(FormField, {
					id: `${NS}-refresh`,
					label: '刷新间隔（秒）',
					hint: '自动轮询间隔，最小 10 秒。',
					type: 'number',
					value: draft?.refreshIntervalSec ?? '',
					onChange: (next) => setDraft((d) => ({ ...d, refreshIntervalSec: next })),
				}),
				createElement(FormField, {
					id: `${NS}-timeout`,
					label: '请求超时（秒）',
					hint: '单次请求等待上限，最小 1 秒。',
					type: 'number',
					value: draft?.timeoutSec ?? '',
					onChange: (next) => setDraft((d) => ({ ...d, timeoutSec: next })),
				}),
				createElement(FormField, {
					id: `${NS}-baseUrl`,
					label: '接口地址',
					hint: '默认 https://opencode.ai/zen/go/v1/usage。',
					type: 'text',
					value: draft?.baseUrl ?? '',
					onChange: (next) => setDraft((d) => ({ ...d, baseUrl: next })),
				}),
				invalid !== null
					? createElement('p', { className: '_ocgoStatus _ocgoStatusError', role: 'alert' }, invalid)
					: null,
				message !== null
					? createElement(
							'p',
							{
								className: `_ocgoStatus ${message.startsWith('已保存') ? '_ocgoStatusOk' : '_ocgoStatusError'}`,
								role: 'status',
							},
							message
						)
					: null,
				createElement(
					'button',
					{
						type: 'button',
						className: '_ocgoSave',
						disabled: saveDisabled,
						onClick: onSave,
					},
					saving ? '保存中…' : '保存'
				)
			);
		}

		/**
		 * tooltip 文案：已用 X% + 重置时间（绝对时间 + 人性化剩余）。
		 * resetsAt 为 ISO 字符串（官方实测形状）；缺失时只报已用。
		 */
		function tipLabel(name, percent, resetsAt) {
			const usedTail = percent === null ? `${name}已用 …` : `${name}已用 ${Math.round(percent)}%`;
			if (typeof resetsAt !== 'string') return usedTail;
			const at = new Date(resetsAt);
			if (Number.isNaN(at.getTime())) return usedTail;
			const pad = (n) => String(n).padStart(2, '0');
			const dateText = `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
			const remainMs = at.getTime() - Date.now();
			if (remainMs <= 0) return `${usedTail}，${dateText} 重置（已重置）`;
			const minutes = Math.round(remainMs / 60_000);
			const remainText = minutes >= 60
				? `约 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后`
				: `约 ${Math.max(minutes, 1)} 分钟后`;
			return `${usedTail}，${dateText} 重置（${remainText}）`;
		}
		/** 窗口元素：Tooltip 包一层（primitives 缺席位时退回原生 title）。 */
		function WindowChip(props) {
			const { name, percent, resetsAt } = props ?? {};
			const label = tipLabel(name, percent, resetsAt);
			const content = createElement(
				'span',
				{ className: '_ocgoWindow' },
				createElement('span', { className: '_ocgoDot', style: { background: colorOf(percent) } }),
				createElement('span', null, props.label),
				createElement('span', { className: '_ocgoValue' }, percent === null ? '…' : `${Math.round(percent)}%`)
			);
			if (typeof Tooltip === 'function') {
				return createElement(Tooltip, { label, side: 'top', delayMs: 400 }, content);
			}
			return createElement('span', { title: label }, content);
		}

		/** 单个表单字段（label + input + hint）。 */
		function FormField(props) {
			const { id, label, hint, type, value, onChange } = props;
			return createElement('div', { className: '_ocgoField' },
				createElement('label', { className: '_ocgoLabel', htmlFor: id }, label),
				createElement('input', {
					id,
					className: '_ocgoInput',
					type,
					value,
					onChange: (event) => {
						onChange(event.target.value);
					},
				}),
				hint === undefined ? null : createElement('p', { className: '_ocgoHint' }, hint)
			);
		}

		/** 当前足额的默认接口地址（draft 初始化兜底用）。 */
		const DEFAULT_BASE_URL_TEXT = 'https://opencode.ai/zen/go/v1/usage';		/**
		 * snapshot → 可编辑 draft（ready 时立刻有一份可保存的值）。
		 * apiKey 是服务端 redact 值（snapshot 里没有）→ 恒空，表示「不动现值」。
		 */
		function draftFromSnapshot(snapshot) {
			if (!snapshot || snapshot.status !== 'ready') return null;
			const value = snapshot.value ?? {};
			return {
				apiKey: '',
				refreshIntervalSec: String(secondsFrom(value?.refreshIntervalMs, 300)),
				timeoutSec: String(secondsFrom(value?.timeoutMs, 15)),
				baseUrl: typeof value?.baseUrl === 'string' && value.baseUrl !== '' ? value.baseUrl : DEFAULT_BASE_URL_TEXT,
			};
		}

		/** 秒 ↔ 毫秒 的防御换算（缺值回退默认）。 */
		function secondsFrom(ms, fallbackSec) {
			const parsed = Number(ms);
			if (!Number.isFinite(parsed) || parsed <= 0) return fallbackSec;
			return Math.max(1, Math.round(parsed / 1000));
		}

		/** 提交前本地校验（与 Host 侧 min-safe 语义一致；返回 null 表示通过）。 */
		function validateDraft(draft) {
			if (draft === null) return null;
			const refresh = Number(draft.refreshIntervalSec);
			if (!Number.isFinite(refresh) || refresh < 10) return '刷新间隔不得小于 10 秒。';
			const timeout = Number(draft.timeoutSec);
			if (!Number.isFinite(timeout) || timeout < 1) return '请求超时不得小于 1 秒。';
			if (typeof draft.baseUrl !== 'string' || draft.baseUrl.trim() === '') {
				return '接口地址不能为空。';
			}
			return null;
		}

		/** draft → 字段操作序列（null 表示 unset：回到默认 / 下层继承值）。 */
		function opsFromDraft(draft) {
			return [
				['apiKey', draft.apiKey === '' ? null : String(draft.apiKey)],
				['refreshIntervalMs', Math.round(Number(draft.refreshIntervalSec) * 1000)],
				['timeoutMs', Math.round(Number(draft.timeoutSec) * 1000)],
				['baseUrl', draft.baseUrl.trim()],
			];
		}

		/* ==================== 插件管理页配置卡 ==================== */

		/**
		 * PluginsConfigCard —— `plugins.bundle.config`（keyed，键=包名）entry。
		 * 与 SettingsCard 同一份表单，但数据面来自 owner 传入的
		 * `form { state, mutate }`（plugin-manager 页的 ConfigPageForm）且支持
		 * `view: 'summary' | 'page'` 两种渲染宿主（与 dsh-beacon 同款）：
		 *   - summary：一句话描述（bundle 卡的一行）；
		 *   - page：完整表单，提交走一次原子 mutate（带读值 revision 作 fence）。
		 */
		function PluginsConfigCard(props) {
			const view = props?.view ?? 'page';
			/**
			 * 数据源：owner 传的 `form {state, mutate}`（若页面提供）→ 本插件自带的
			 * configForms 控制器（bundle 配置页通常不给 form，必须自给）。
			 */
			const ownerForm = props?.form ?? null;
			const formController = props?.formController ?? null;
			const usingOwner = !!(ownerForm?.state && typeof ownerForm.mutate === 'function');
			const [ownSnapshot, setOwnSnapshot] = useState(() => (usingOwner ? null : formController?.getSnapshot?.() ?? null));
			useEffect(() => {
				if (usingOwner || !formController) return undefined;
				setOwnSnapshot(formController.getSnapshot());
				return formController.subscribe(() => {
					setOwnSnapshot(formController.getSnapshot());
				});
			}, [usingOwner, formController]);
			const handle = usingOwner
				? { state: ownerForm.state, mutate: ownerForm.mutate }
				: formController !== null
					? { state: ownSnapshot, mutate: (ops, revision) => formController.mutate(ops, revision) }
					: null;
			if (view === 'summary') {
				return createElement(
					'div',
					{ className: '_ocgoField' },
					createElement(
						'span',
						{ className: '_ocgoHeading' },
						`${SECTION_LABEL} —— 在输入框下方用量条内有 ⟳ 刷新与 ⚙ 设置入口；也可在本页编辑配置。`
					)
				);
			}
			if (!handle || !handle.state) {
				return createElement('p', { className: '_ocgoLoading' }, '加载中…');
			}
			const snapshot = handle.state;
			if (snapshot.status === 'unavailable') {
				return createElement('p', { className: '_ocgoLoading' },
					'当前部署以只读方式保存设置（远程浏览器实例不落宿主文档），请在本地 dsh 中修改。');
			}
			if (snapshot.status !== 'ready') {
				return createElement('p', { className: '_ocgoLoading' }, '加载中…');
			}
			return createElement(
				SettingsCardDataless,
				{ snapshot, mutate: handle.mutate, heading: SECTION_LABEL },
				null
			);
		}

		/**
		 * SettingsCardDataless —— 与 SettingsCard 同型表单，但数据由调用方给
		 * （snapshot + 原子 mutate）；供插件管理页复用，不重复订阅。
		 */
		function SettingsCardDataless(props) {
			const { snapshot, mutate, heading } = props ?? {};
			const value = snapshot?.value ?? null;
			const [draft, setDraft] = useState(() => draftFromSnapshot(snapshot));
			const [saving, setSaving] = useState(false);
			const [message, setMessage] = useState(null);
			// snapshot 版本变化（e.g. 他处写入后宿主推进）→ 重建一份 draft
			useEffect(() => {
				setDraft(draftFromSnapshot(snapshot));
			}, [snapshot]);
			const invalid = validateDraft(draft);
			const saveDisabled = saving || draft === null || invalid !== null || snapshot?.writable === false;
			const onSave = useCallback(async () => {
				if (draft === null || saving) return;
				setSaving(true);
				setMessage(null);
				try {
					const ops = opsFromDraft(draft).map(([field, payload]) =>
						payload === null ? { op: 'unset', path: [field] } : { op: 'set', path: [field], value: payload }
					);
					const accepted = await mutate(ops, snapshot?.revision);
					if (accepted === false) {
						setMessage('保存未生效：宿主拒绝了这次修改（可能是最近被他处改动）。');
						return;
					}
					setMessage('已保存：配置立即生效（定时器已按新间隔重建）。');
				} catch (error) {
					setMessage(`保存失败：${error instanceof Error ? error.message : String(error)}`);
				} finally {
					setSaving(false);
				}
			}, [draft, saving, mutate, snapshot?.revision]);
			// UI 与 SettingsCard 复用同套字段（少了 Form 的外部控制器）。
			return createElement(
				'div',
				{ className: '_ocgoCard' },
				createElement('h2', { className: '_ocgoTitle' }, heading ?? SECTION_LABEL),
				createElement('p', { className: '_ocgoHint' }, '保存后立即生效：Host 半边会自动重建轮询定时器，无需重启 dsh web。'),
				draft === null
					? null
					: [
							createElement(FormField, {
								key: `${NS}-pp-key`,
								id: `${NS}-pluginpage-apiKey`,
								label: 'API Key',
								hint: '留空表示保持现有来源（环境变量 / 凭据库）。为安全起见已保存的值不会回显。',
								type: 'password',
								value: draft.apiKey,
								onChange: (next) => setDraft((d) => ({ ...d, apiKey: next })),
							}),
							createElement(FormField, {
								key: `${NS}-pp-refresh`,
								id: `${NS}-pluginpage-refresh`,
								label: '刷新间隔（秒）',
								hint: '自动轮询间隔，最小 10 秒。',
								type: 'number',
								value: draft.refreshIntervalSec,
								onChange: (next) => setDraft((d) => ({ ...d, refreshIntervalSec: next })),
							}),
							createElement(FormField, {
								key: `${NS}-pp-timeout`,
								id: `${NS}-pluginpage-timeout`,
								label: '请求超时（秒）',
								hint: '单次请求等待上限，最小 1 秒。',
								type: 'number',
								value: draft.timeoutSec,
								onChange: (next) => setDraft((d) => ({ ...d, timeoutSec: next })),
							}),
							createElement(FormField, {
								key: `${NS}-pp-baseUrl`,
								id: `${NS}-pluginpage-baseUrl`,
								label: '接口地址',
								hint: '默认 https://opencode.ai/zen/go/v1/usage。',
								type: 'text',
								value: draft.baseUrl,
								onChange: (next) => setDraft((d) => ({ ...d, baseUrl: next })),
							}),
							invalid !== null
								? createElement('p', { key: `${NS}-pp-invalid`, className: '_ocgoStatus _ocgoStatusError', role: 'alert' }, invalid)
								: null,
							message !== null
								? createElement(
										'p',
										{
											key: `${NS}-pp-message`,
											className: `_ocgoStatus ${message.startsWith('已保存') ? '_ocgoStatusOk' : '_ocgoStatusError'}`,
											role: 'status',
										},
										message
									)
								: null,
							createElement(
								'button',
								{
									key: `${NS}-pp-save`,
									type: 'button',
									className: '_ocgoSave',
									disabled: saveDisabled,
									onClick: onSave,
								},
								saving ? '保存中…' : '保存'
							),
						]
			);
		}

		/* ==================== 插件 face ==================== */

		return {
			inject: ['slots', 'configForms', 'remote'],
			apply(ctx) {
				injectStyleOnce();

				/** settings 表单控制器（读写配置的统一通道）。 */
				const form = ctx.configForms.get(NS);

				/**
				 * RemoteResult 形状折叠：客户端远程调用返回
				 *   { ok: true, value: <Host 业务结果> } 或 { ok: false, error }。
				 * Host 业务结果本身是 { ok, data } / { ok, reason: no-key }，
				 * 所以要拆两层，最终对齐 UsageDock 期望的单一形状。
				 */
				function normalize(resultPromise) {
					return Promise.resolve(resultPromise).then((result) => {
						if (!result || typeof result !== 'object' || !('ok' in result)) {
							return { ok: false, reason: 'network' };
						}
						if (result.ok === true) {
							const value = result.value;
							if (value && typeof value === 'object' && 'ok' in value) return value;
							return { ok: false, reason: 'network' };
						}
						return reasonOf(result.error);
					});
				}
				/**
				 * Remote failure 的稳定 code → UI 一行文案用的 reason。
				 * no-key 走的是 Host 业务结果（上面一层），Remote failure 全部
				 * 折成 'network'（cancelled 也如此：重试按钮可以继续）。
				 */
				function reasonOf(_error) {
					return 'network';
				}

				/**
				 * 远程命名空间的调用链。规则：不要在**本插件 fiber** 里直接读
				 * `ctx.remote[NS]` —— 那个被跟踪的子属性需要
				 * `remote.ocgo-usage-dock` 出现在读方 fiber 的 inject 允许列表，
				 * 否则 cordis 抛 `cannot get property ... without inject`（真机
				 * 实测）。正确做法是经 `ctx.inject([...], cb)` 起一个**子 fiber**，
				 * 它的 inject 声明就是这一个 dotted 名，读取合法（由 cordis 的
				 * dispatch 门控保证服务已就绪后才回调）。
				 */
				let nsFace = null;
				const pendingCalls = [];
				ctx.inject([`remote.${NS}`], (nsCtx) => {
					try {
						nsFace = nsCtx.remote[NS];
					} catch (error) {
						console.warn('ocgo-usage-dock: 远程命名空间绑定失败', error);
						return;
					}
					// dump 积压：绑定前的调用按发起顺序补发
					for (const [method, resolve] of pendingCalls.splice(0)) {
						Promise.resolve()
							.then(() => nsFace?.[method]?.())
							.then((result) => {
								resolve(result);
							}, () => {
								resolve({ ok: false, reason: 'network' });
							});
					}
				});

				/**
				 * 业务 face：绑定未就绪时先记队列（调用随绑定完成而落），设一个
				 * 兜底超时——10 秒后仍未绑定（$mount 失败/命名空间挂不上）则按
				 * 远程不可用折叠（dock 显示错误行 + 重试，而不是无声卡住）。
				 */
				const callNamespace = (method) => {
					if (nsFace !== null) return nsFace[method]();
					return new Promise((resolve) => {
						pendingCalls.push([method, resolve]);
						setTimeout(() => {
							const index = pendingCalls.findIndex((entry) => entry[1] === resolve);
							if (index >= 0) {
								pendingCalls.splice(index, 1);
								resolve({ ok: false, reason: 'network' });
							}
						}, 10_000);
					});
				};
				const ocko = {
					initial() {
						return normalize(callNamespace('fetchCached'));
					},
					refresh() {
						return normalize(callNamespace('fetch'));
					},
					/**
					 * 当前应采用的客户端轮询间隔（毫秒）——每轮现场从 settings 快照
					 * 读，设置页保存新间隔后下一轮立即生效（无需重载页面）。
					 */
					poll() {
						try {
							const snap = form.getSnapshot();
							const ms = Number(snap?.value?.refreshIntervalMs);
							if (Number.isFinite(ms) && ms > 0) return ms;
						} catch {
							/* 快照不可用时用默认 */
						}
						return DEFAULT_REFRESH_INTERVAL_MS;
					},
					openSettings() {
						openSettingsAtSection();
					},
				};

				/** 挂 Remote 贡献（`ctx.remote[NS]` 随本 fiber 上下线）。 */
				ctx.effect(() => ctx.remote.$mount(OCKER_REMOTE), 'ocgo-usage-dock: remote mount');

				/**
				 * 1. 输入框下方用量条：槽位属于 ui-conversation 装配链，声明就绪才
				 *    注册（ctx.slots.inject 已通过 ctx.effect 保证可逆生命周期）。
				 */
				ctx.slots.inject(SLOT_DOCK, () => {
					try {
						return ctx.slots.register(
							{ name: SLOT_DOCK, id: NS, order: DOCK_ORDER, inject: () => ({ ocko }) },
							UsageDock
						);
					} catch (error) {
						console.warn('ocgo-usage-dock: composer dock 注册失败（宿主未装配该槽？）', error);
						return () => {};
					}
				});

				/**
				 * 3. 插件管理页的 bundle 配置卡（keyed，键 = 包名）—— 本插件唯一的
				 *    设置入口。owner 侧给 `view: 'summary' | 'page'`（form 可选，不
				 *    给就用自己的 configForms 控制器自给）。
				 */
				ctx.slots.inject(SLOT_PLUGINS_CONFIG, () => {
					try {
						return ctx.slots.register(
							{
								name: SLOT_PLUGINS_CONFIG,
								key: PKG_NAME,
								inject: () => ({ formController: form }),
							},
							PluginsConfigCard
						);
					} catch (error) {
						console.warn('ocgo-usage-dock: plugins 配置卡注册失败（宿主未装配该槽？）', error);
						return () => {};
					}
				});
			},
		};
	},
});
