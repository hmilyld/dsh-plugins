/** Values shared with the browser half over the Typert Remote boundary. */

/** What the configured database turned out to be. */
export type OpencodeSchemaStatus = 'v2' | 'missing' | 'unsupported'

/** Outcome of one scan. */
export interface ImportReport {
  /** Wall clock at the start of the scan. */
  startedAt: number
  /** Wall clock after the last candidate settled. */
  finishedAt: number
  /** Database path the scan actually used. */
  dbPath: string
  /** Whether the database could be opened and read. */
  dbAvailable: boolean
  /** Schema generation observed in the database. */
  schema: OpencodeSchemaStatus
  /** Registered DSH workspaces considered by this scan. */
  workspaces: number
  /** Root OpenCode sessions whose directory matched a workspace. */
  discovered: number
  /** Sessions written and attached during this scan. */
  imported: number
  /** Sessions left alone because an identical DSH session already exists. */
  skipped: number
  /** Sessions that failed; details are in {@link ImportReport.errors}. */
  failed: number
  /** Root OpenCode sessions whose directory is not a registered workspace. */
  unmatchedSessions: number
  /** Distinct unmatched directories, newest activity first. */
  unmatchedDirectories: string[]
  /** Bounded, user-readable failure lines. */
  errors: string[]
}

/** Host state the settings card renders before and after a scan. */
export interface ImportStatus {
  /** Database path resolved from configuration and platform defaults. */
  dbPath: string
  /** Whether that path currently opens. */
  dbAvailable: boolean
  /** Schema generation observed on the last probe. */
  schema: OpencodeSchemaStatus
  /** Root, unarchived OpenCode sessions in the database. */
  opencodeSessions: number
  /** DSH sessions minted by this plugin that still exist. */
  importedSessions: number
  /** Whether a scan is running right now. */
  scanning: boolean
  /** Last completed scan, or null before the first one. */
  lastReport: ImportReport | null
}

/** One row of the settings-card preview. */
export interface PreviewRow {
  /** OpenCode session identity. */
  opencodeSessionId: string
  /** DSH session identity this row maps to. */
  dshSessionId: string
  /** Display title. */
  title: string
  /** Recorded OpenCode working directory. */
  directory: string
  /** Registered workspace the row would import into, or null when unmatched. */
  workspacePath: string | null
  /** Last OpenCode activity. */
  timeUpdated: number
  /** Stored OpenCode messages for this session. */
  messageCount: number
  /** Whether the DSH session already exists. */
  imported: boolean
}

/** Read-only scan preview. */
export interface PreviewSnapshot {
  /** Rows in display order, capped at the preview limit. */
  rows: PreviewRow[]
  /** Directories with sessions but no registered workspace. */
  unmatchedDirectories: string[]
  /** Whether rows were dropped by the preview limit. */
  truncated: boolean
}
