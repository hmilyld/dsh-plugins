/** Plugin configuration. */
import type { Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /**
   * Absolute path to `opencode.db`, or the empty string to probe the platform
   * default. A probe failure is reported, never fatal.
   */
  dbPath: Volatile<string>
  /** Scan once after the plugin loads. */
  autoScanOnStart: Volatile<boolean>
  /** Rescan when the workspace registry gains or changes a workspace. */
  scanOnWorkspaceCreate: Volatile<boolean>
  /** Import tool calls and their results, not only conversation text. */
  includeToolCalls: Volatile<boolean>
  /** Import assistant reasoning blocks. */
  includeReasoning: Volatile<boolean>
  /** Keep only the newest N messages of one OpenCode session; `0` keeps all. */
  maxMessagesPerSession: Volatile<number>
  /** Directories whose sessions are never imported, including their children. */
  excludedDirectories: Volatile<string[]>
}

export const Config = Schema.object({
  dbPath: Schema.string().default('').volatile(),
  autoScanOnStart: Schema.boolean().default(true).volatile(),
  scanOnWorkspaceCreate: Schema.boolean().default(true).volatile(),
  includeToolCalls: Schema.boolean().default(true).volatile(),
  includeReasoning: Schema.boolean().default(true).volatile(),
  maxMessagesPerSession: Schema.number().min(0).default(0).volatile(),
  excludedDirectories: Schema.array(Schema.string()).default([]).volatile(),
})
