/** Locale bundles for the settings card, row mark, and conversation notice. */
import type { CommonLocaleKey } from '@hmilyld/dsh-plugin-kit'

export const NS = 'settings.opencode-import'

export type LocaleKey =
  | CommonLocaleKey
  | 'description'
  | 'database'
  | 'databasePath'
  | 'databasePathHint'
  | 'databaseMissing'
  | 'databaseUnsupported'
  | 'databaseReady'
  | 'opencodeSessions'
  | 'importedSessions'
  | 'autoScan'
  | 'autoScanHint'
  | 'scanOnWorkspace'
  | 'scanOnWorkspaceHint'
  | 'includeToolCalls'
  | 'includeToolCallsHint'
  | 'includeReasoning'
  | 'includeReasoningHint'
  | 'maxMessages'
  | 'maxMessagesHint'
  | 'invalidNumber'
  | 'invalidValue'
  | 'excludedDirectories'
  | 'excludedDirectoriesHint'
  | 'scanNow'
  | 'scanning'
  | 'scanFailed'
  | 'lastScan'
  | 'neverScanned'
  | 'reportImported'
  | 'reportSkipped'
  | 'reportFailed'
  | 'reportUnmatched'
  | 'reportErrors'
  | 'preview'
  | 'previewHint'
  | 'previewEmpty'
  | 'previewTruncated'
  | 'previewImported'
  | 'previewPending'
  | 'previewUnmatched'
  | 'importedBadge'
  | 'noticeTitle'
  | 'noticeBody'
  | 'noticeDismiss'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.opencode-import': LocaleKey
  }
}

export const en: Record<LocaleKey, string> = {
  description:
    'Import OpenCode conversations of a workspace into the DSH session list as real, openable sessions.',
  database: 'OpenCode database',
  databasePath: 'Database path',
  databasePathHint: 'Leave empty to use the platform default (~/.local/share/opencode/opencode.db).',
  databaseMissing: 'The database was not found or cannot be opened.',
  databaseUnsupported: 'This OpenCode schema is not supported (session_v2 is required).',
  databaseReady: 'Database reachable.',
  opencodeSessions: 'OpenCode sessions',
  importedSessions: 'Imported sessions',
  autoScan: 'Scan at startup',
  autoScanHint: 'Run one import pass shortly after the plugin loads.',
  scanOnWorkspace: 'Scan when a workspace is added',
  scanOnWorkspaceHint: 'Rescan when the workspace registry gains or changes a workspace.',
  includeToolCalls: 'Import tool calls',
  includeToolCallsHint: 'Keep tool calls and their results in the transcript.',
  includeReasoning: 'Import reasoning',
  includeReasoningHint: 'Keep assistant reasoning blocks in the transcript.',
  maxMessages: 'Messages per session',
  maxMessagesHint: 'Keep only the newest N conversation messages; 0 keeps everything.',
  invalidNumber: 'Enter a whole number of 0 or more.',
  invalidValue: 'Enter a value.',
  excludedDirectories: 'Excluded directories',
  excludedDirectoriesHint: 'One absolute path per line. Sessions under them are never imported.',
  scanNow: 'Scan now',
  scanning: 'Scanning…',
  scanFailed: 'The scan did not complete.',
  lastScan: 'Last scan',
  neverScanned: 'No scan has run yet.',
  reportImported: 'imported',
  reportSkipped: 'skipped',
  reportFailed: 'failed',
  reportUnmatched: 'unmatched',
  reportErrors: 'Errors',
  preview: 'OpenCode sessions',
  previewHint: 'Read-only view of the current database and workspace matches.',
  previewEmpty: 'No OpenCode session found.',
  previewTruncated: 'Only the newest sessions are shown.',
  previewImported: 'Imported',
  previewPending: 'Pending',
  previewUnmatched: 'No workspace',
  importedBadge: 'Imported from OpenCode',
  noticeTitle: 'This session was imported from OpenCode',
  noticeBody:
    'Continuing here diverges from OpenCode: new messages stay in DSH and OpenCode will not see them.',
  noticeDismiss: 'Dismiss',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values.',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  updateAvailable: 'A newer release v{latest} is available (running v{current}).',
  updateChangelog: 'View release notes',
}

export const zh: Record<LocaleKey, string> = {
  description: '把工作区的 OpenCode 对话导入 DSH 会话列表，成为可打开的真实会话。',
  database: 'OpenCode 数据库',
  databasePath: '数据库路径',
  databasePathHint: '留空使用平台默认路径（~/.local/share/opencode/opencode.db）。',
  databaseMissing: '未找到数据库，或无法打开。',
  databaseUnsupported: '当前 OpenCode 数据结构不受支持（需要 session_v2）。',
  databaseReady: '数据库可读取。',
  opencodeSessions: 'OpenCode 会话',
  importedSessions: '已导入会话',
  autoScan: '启动时扫描',
  autoScanHint: '插件加载后不久执行一次导入。',
  scanOnWorkspace: '新增工作区时扫描',
  scanOnWorkspaceHint: '工作区注册表新增或变更时重新扫描。',
  includeToolCalls: '导入工具调用',
  includeToolCallsHint: '保留工具调用及其结果。',
  includeReasoning: '导入推理内容',
  includeReasoningHint: '保留助手的推理块。',
  maxMessages: '单会话消息上限',
  maxMessagesHint: '只保留最新的 N 条对话消息；0 表示全部保留。',
  invalidNumber: '请输入 0 或更大的整数。',
  invalidValue: '请填写一个值。',
  excludedDirectories: '排除目录',
  excludedDirectoriesHint: '每行一个绝对路径；其下的会话不会被导入。',
  scanNow: '立即扫描',
  scanning: '扫描中…',
  scanFailed: '扫描未完成。',
  lastScan: '上次扫描',
  neverScanned: '还没有执行过扫描。',
  reportImported: '导入',
  reportSkipped: '跳过',
  reportFailed: '失败',
  reportUnmatched: '未匹配',
  reportErrors: '错误',
  preview: 'OpenCode 会话',
  previewHint: '当前数据库与工作区匹配情况（只读）。',
  previewEmpty: '没有找到 OpenCode 会话。',
  previewTruncated: '仅显示最新的会话。',
  previewImported: '已导入',
  previewPending: '待导入',
  previewUnmatched: '无工作区',
  importedBadge: '从 OpenCode 导入',
  noticeTitle: '此会话由 OpenCode 导入',
  noticeBody: '在这里继续对话会与 OpenCode 分叉：新消息只留在 DSH，OpenCode 侧看不到。',
  noticeDismiss: '知道了',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值。',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载。',
  overridden: '已覆盖',
  reset: '恢复默认',
  updateAvailable: '发现新版本 v{latest}（当前 v{current}）。',
  updateChangelog: '查看更新说明',
}
