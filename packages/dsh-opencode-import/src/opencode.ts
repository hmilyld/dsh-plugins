/** Read-only access to the OpenCode SQLite store. */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { OpencodeSchemaStatus } from './types.ts'

/** One root or child conversation recorded by OpenCode. */
export interface OpencodeSession {
  /** OpenCode session id (`ses_…`). */
  id: string
  /** Display title as OpenCode recorded it. */
  title: string
  /** Working directory the conversation ran in. */
  directory: string
  /** Parent session id for a child conversation. */
  parentId: string | undefined
  /** Creation timestamp in epoch milliseconds. */
  timeCreated: number
  /** Last activity timestamp in epoch milliseconds. */
  timeUpdated: number
  /** Whether OpenCode archived the conversation. */
  archived: boolean
}

/** One stored conversation event. */
export interface OpencodeMessage {
  /** Event kind; only `user` and `assistant` carry conversation content. */
  type: string
  /** Dense per-session sequence number. */
  seq: number
  /** Event timestamp in epoch milliseconds. */
  time: number
  /** Parsed JSON payload. */
  data: Record<string, unknown>
}

/** Raised when the configured database cannot serve the v2 schema. */
export class OpencodeUnavailableError extends Error {
  constructor(
    message: string,
    /** Schema generation the probe reached before failing. */
    readonly schema: OpencodeSchemaStatus,
  ) {
    super(message)
    this.name = 'OpencodeUnavailableError'
  }
}

/**
 * Resolve the platform default OpenCode data directory.
 *
 * OpenCode follows the XDG base-directory rules on POSIX and `%LOCALAPPDATA%`
 * on Windows; both put the SQLite store directly in the data directory.
 *
 * @param env - environment to read; defaults to `process.env`.
 * @param platform - platform to assume; defaults to `process.platform`.
 * @returns absolute path to `opencode.db`, whether or not it exists.
 */
export function defaultOpencodeDbPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    return join(base, 'opencode', 'opencode.db')
  }
  const base = env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share')
  return join(base, 'opencode', 'opencode.db')
}

/** Whether one table exists in the opened database. */
function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name?: string } | undefined
  return row?.name === name
}

/** Coerce one stored column into a string, or undefined. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Coerce one stored column into a finite number, or undefined. */
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** One opened read-only OpenCode store. */
export class OpencodeDatabase {
  private constructor(private readonly db: DatabaseSync) {}

  /**
   * Open the store read-only and verify the schema generation.
   *
   * @param path - absolute `opencode.db` path.
   * @returns the open store; the caller closes it.
   * @throws {OpencodeUnavailableError} when the file is missing, locked, or
   * carries no schema this plugin can read.
   */
  static open(path: string): OpencodeDatabase {
    let db: DatabaseSync
    try {
      db = new DatabaseSync(path, { readOnly: true })
    } catch (error) {
      throw new OpencodeUnavailableError(
        `cannot open ${path}: ${error instanceof Error ? error.message : String(error)}`,
        'missing',
      )
    }
    if (!tableExists(db, 'session_v2') || !tableExists(db, 'session_message')) {
      db.close()
      throw new OpencodeUnavailableError(
        `${path} has no session_v2/session_message tables; this OpenCode schema is not supported`,
        'unsupported',
      )
    }
    return new OpencodeDatabase(db)
  }

  /**
   * Read every recorded session, including children and archived rows.
   *
   * @returns rows in no promised order; callers filter.
   */
  sessions(): OpencodeSession[] {
    const rows = this.db
      .prepare(
        'SELECT id, title, directory, parent_id, time_created, time_updated, time_archived FROM session_v2',
      )
      .all() as Record<string, unknown>[]
    const sessions: OpencodeSession[] = []
    for (const row of rows) {
      const id = text(row.id)
      const directory = text(row.directory)
      const timeCreated = count(row.time_created)
      const timeUpdated = count(row.time_updated)
      if (id === undefined || directory === undefined || timeCreated === undefined) continue
      sessions.push({
        id,
        title: text(row.title) ?? '',
        directory,
        parentId: text(row.parent_id),
        timeCreated,
        timeUpdated: timeUpdated ?? timeCreated,
        archived: count(row.time_archived) !== undefined,
      })
    }
    return sessions
  }

  /**
   * Count stored messages per session.
   *
   * @returns one count per session that has messages.
   */
  messageCounts(): Map<string, number> {
    const rows = this.db
      .prepare('SELECT session_id, COUNT(*) AS total FROM session_message GROUP BY session_id')
      .all() as Record<string, unknown>[]
    const counts = new Map<string, number>()
    for (const row of rows) {
      const id = text(row.session_id)
      const total = count(row.total)
      if (id !== undefined && total !== undefined) counts.set(id, total)
    }
    return counts
  }

  /**
   * Read one session's stored events in sequence order.
   *
   * Malformed payloads are skipped rather than aborting the session: a single
   * unreadable row must not hide the rest of a conversation.
   *
   * @param sessionId - OpenCode session id.
   * @returns parsed events.
   */
  messages(sessionId: string): OpencodeMessage[] {
    const rows = this.db
      .prepare(
        'SELECT type, seq, time_created, data FROM session_message WHERE session_id = ? ORDER BY seq ASC',
      )
      .all(sessionId) as Record<string, unknown>[]
    const messages: OpencodeMessage[] = []
    for (const row of rows) {
      const type = text(row.type)
      const raw = text(row.data)
      const seq = count(row.seq)
      if (type === undefined || raw === undefined || seq === undefined) continue
      let data: unknown
      try {
        data = JSON.parse(raw)
      } catch {
        continue
      }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) continue
      messages.push({
        type,
        seq,
        time: count(row.time_created) ?? 0,
        data: data as Record<string, unknown>,
      })
    }
    return messages
  }

  /** Release the database handle. */
  close(): void {
    this.db.close()
  }
}
