/** Locale bundles for the usage dock and its settings page. */

/** Namespace shared by the dock and the settings card. */
export const NS = 'settings.ocgoUsage'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.ocgoUsage': OcgoLocaleKey
  }
}

/** Keys the dock and settings card render. */
export type OcgoLocaleKey =
  | 'title'
  | 'description'
  | 'dockLabel'
  | 'windowRolling'
  | 'windowWeekly'
  | 'windowMonthly'
  | 'refresh'
  | 'refreshing'
  | 'openSettings'
  | 'errorTitle'
  | 'errorTimeout'
  | 'errorNetwork'
  | 'errorHttp'
  | 'retry'
  | 'resetAt'
  | 'resetIn'
  | 'updatedJustNow'
  | 'updatedMinutes'
  | 'legacyNotice'
  | 'clearLegacy'
  | 'clearingLegacy'
  | 'apiKeyEnv'
  | 'apiKeyEnvHint'
  | 'apiKey'
  | 'apiKeyHint'
  | 'apiKeySet'
  | 'apiKeyUnset'
  | 'refreshSeconds'
  | 'refreshSecondsHint'
  | 'invalidRefresh'
  | 'timeoutSeconds'
  | 'timeoutSecondsHint'
  | 'invalidTimeout'
  | 'baseUrl'
  | 'baseUrlHint'
  | 'overridden'
  | 'reset'
  | 'readOnly'
  | 'unavailable'
  | 'save'
  | 'saving'
  | 'saveFailed'
  | 'invalidNumber'
  | 'updateAvailable'
  | 'updateChangelog'

/** English copy. */
export const en: Record<OcgoLocaleKey, string> = {
  title: 'OpenCode Go usage',
  description:
    'Show OpenCode Go rolling, weekly, and monthly usage above the composer, using a key stored outside the settings file.',
  dockLabel: 'OpenCode Go usage',
  windowRolling: '5-hour',
  windowWeekly: 'Weekly',
  windowMonthly: 'Monthly',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  openSettings: 'Open settings',
  errorTitle: 'Usage unavailable',
  errorTimeout: 'The usage endpoint timed out.',
  errorNetwork: 'Could not reach the usage endpoint.',
  errorHttp: 'The usage endpoint refused the request',
  retry: 'Retry',
  resetAt: 'Resets',
  resetIn: 'Resets in',
  updatedJustNow: 'Updated just now',
  updatedMinutes: 'Updated {minutes} min ago',
  legacyNotice:
    'This profile still uses the deprecated apiKey setting. Clear it after storing the key below so the credential reference takes effect.',
  clearLegacy: 'Clear deprecated key',
  clearingLegacy: 'Clearing…',
  apiKeyEnv: 'Credential reference',
  apiKeyEnvHint:
    'Name of the environment variable that holds the key, for example OPENCODE_GO_API_KEY. The key is resolved by the Host on each request.',
  apiKey: 'API key',
  apiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
  apiKeySet: 'A key is configured.',
  apiKeyUnset: 'No key is configured yet.',
  refreshSeconds: 'Refresh interval (seconds)',
  refreshSecondsHint: 'How often the dock asks the Host for usage. Minimum 10 seconds.',
  invalidRefresh: 'Enter a whole number of seconds, 10 or greater.',
  timeoutSeconds: 'Request timeout (seconds)',
  timeoutSecondsHint: 'How long one usage request may take. Minimum 1 second.',
  invalidTimeout: 'Enter a whole number of seconds, 1 or greater.',
  baseUrl: 'Usage endpoint',
  baseUrlHint: 'Leave blank to use the default OpenCode Go usage endpoint.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
  updateAvailable: 'A newer release v{latest} is available (running v{current}).',
  updateChangelog: 'View release notes',
}

/** Simplified Chinese copy. */
export const zh: Record<OcgoLocaleKey, string> = {
  title: 'OpenCode Go 用量',
  description:
    '在输入框上方显示 OpenCode Go 的 5 小时、每周与每月用量；密钥保存在设置文件之外。',
  dockLabel: 'OpenCode Go 用量',
  windowRolling: '5 小时',
  windowWeekly: '本周',
  windowMonthly: '本月',
  refresh: '刷新',
  refreshing: '刷新中…',
  openSettings: '打开设置',
  errorTitle: '用量暂不可用',
  errorTimeout: '用量接口请求超时。',
  errorNetwork: '无法连接用量接口。',
  errorHttp: '用量接口拒绝了请求',
  retry: '重试',
  resetAt: '重置时间',
  resetIn: '距离重置',
  updatedJustNow: '刚刚更新',
  updatedMinutes: '{minutes} 分钟前更新',
  legacyNotice:
    '当前配置仍在使用已弃用的 apiKey 字段。请在下方保存密钥后清除旧字段，凭证引用才会生效。',
  clearLegacy: '清除旧版密钥',
  clearingLegacy: '清除中…',
  apiKeyEnv: '凭证引用',
  apiKeyEnvHint:
    '保存密钥的环境变量名，例如 OPENCODE_GO_API_KEY。Host 会在每次请求时重新解析。',
  apiKey: 'API Key',
  apiKeyHint: '不写入设置文件。留空表示保持当前密钥。',
  apiKeySet: '已配置密钥。',
  apiKeyUnset: '尚未配置密钥。',
  refreshSeconds: '刷新间隔（秒）',
  refreshSecondsHint: '用量条向 Host 取数的频率，最小 10 秒。',
  invalidRefresh: '请填不小于 10 的整数秒数。',
  timeoutSeconds: '请求超时（秒）',
  timeoutSecondsHint: '单次用量请求的最长等待时间，最小 1 秒。',
  invalidTimeout: '请填不小于 1 的整数秒数。',
  baseUrl: '用量接口地址',
  baseUrlHint: '留空使用 OpenCode Go 默认用量接口。',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidNumber: '请填数字；留空表示使用默认值。',
  updateAvailable: '发现新版本 v{latest}（当前 v{current}）。',
  updateChangelog: '查看更新说明',
}
