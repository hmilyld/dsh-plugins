/** Locale bundles for the beacon settings card. */
import type { CommonLocaleKey } from '@hmilyld/dsh-plugin-kit'

/** Namespace shared by the settings card. */
export const NS = 'settings.beacon'

/** Plugin-specific keys, merged with the Kit's common vocabulary. */
export type BeaconLocaleKey =
  | CommonLocaleKey
  | 'description'
  | 'webhookUrl'
  | 'webhookUrlHint'
  | 'payloadTemplate'
  | 'payloadTemplateHint'
  | 'headers'
  | 'headersHint'
  | 'triggerOnUserQuestion'
  | 'triggerOnUserQuestionHint'
  | 'skipSubagents'
  | 'skipSubagentsHint'
  | 'dedupWindowMs'
  | 'dedupWindowMsHint'
  | 'invalidJson'
  | 'invalidNumber'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.beacon': BeaconLocaleKey
  }
}

/** English copy. */
export const en: Record<BeaconLocaleKey, string> = {
  description:
    'Notify a webhook when a task completes or the agent needs a question, plan confirmation, or approval.',
  webhookUrl: 'Webhook URL',
  webhookUrlHint:
    'POST one JSON payload here on completion, questions, plan confirmation, and approvals. Leave blank to disable sending.',
  payloadTemplate: 'Payload template',
  payloadTemplateHint:
    'Supports {{eventType}} / {{summary}} / {{sessionId}} / {{time}}; the rendered result must be valid JSON.',
  headers: 'Headers (JSON object)',
  headersHint: 'For example {"Content-Type":"application/json"}. Clear to restore the default.',
  triggerOnUserQuestion: 'Notify on questions',
  triggerOnUserQuestionHint:
    'Send when the agent asks the user. Plan confirmation and approvals are not affected by this switch.',
  skipSubagents: 'Skip subagents',
  skipSubagentsHint:
    'Do not send completion or tool fallbacks for subagent sessions. Questions and approvals are not filtered.',
  dedupWindowMs: 'Dedup window (ms)',
  dedupWindowMsHint: 'One send per session and event type inside this window.',
  invalidJson: 'Enter a valid JSON object of string values.',
  invalidNumber: 'Enter a number.',
  invalidValue: 'Enter a value.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  updateAvailable: 'A newer release v{latest} is available (running v{current}).',
  updateChangelog: 'View release notes',
}

/** Simplified Chinese copy. */
export const zh: Record<BeaconLocaleKey, string> = {
  description: '任务完成、Agent 提问、计划确认、工具审批时向预设地址推送提醒。',
  webhookUrl: 'Webhook 地址',
  webhookUrlHint: '任务完成、提问、计划确认、审批时向这里 POST 一条 JSON。留空则不发送。',
  payloadTemplate: 'Payload 模板',
  payloadTemplateHint:
    '支持 {{eventType}} / {{summary}} / {{sessionId}} / {{time}}；渲染结果必须是合法 JSON。',
  headers: '请求头（JSON 对象）',
  headersHint: '形如 {"Content-Type":"application/json"}；清空即恢复默认。',
  triggerOnUserQuestion: '提问时提醒',
  triggerOnUserQuestionHint: 'Agent 向用户提问时推送；计划确认与审批不受这个开关影响。',
  skipSubagents: '跳过子代理',
  skipSubagentsHint: '子代理的任务完成与工具路径通知不推送；审批与提问不过滤。',
  dedupWindowMs: '去重窗口（毫秒）',
  dedupWindowMsHint: '同一会话同一事件类型在窗口内只发一次。',
  invalidJson: '请填写由字符串值组成的合法 JSON 对象。',
  invalidNumber: '请填数字。',
  invalidValue: '请填写一个值。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  overridden: '已覆盖默认值',
  reset: '恢复默认',
  updateAvailable: '发现新版本 v{latest}（当前 v{current}）。',
  updateChangelog: '查看更新说明',
}
