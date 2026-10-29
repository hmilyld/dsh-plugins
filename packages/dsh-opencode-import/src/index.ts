/**
 * Host half of `@hmilyld/dsh-opencode-import`.
 *
 * The plugin owns the whole import: it reads the OpenCode SQLite store
 * read-only, maps each conversation into DSH session events, writes a real
 * session log, warms the projection cache so the sidebar row carries the
 * imported title, and attaches the session to the workspace whose directory the
 * conversation ran in. The browser half only renders settings, a read-only
 * preview, and the imported-row decoration.
 */
import { isVolatile } from '@deepseek-ai/cosmokit'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { Config } from './config.ts'
import type { Config as ConfigShape } from './config.ts'
import {
  MAX_REPORT_ERRORS,
  PREVIEW_LIMIT,
  STARTUP_SCAN_DELAY_MS,
  WORKSPACE_SCAN_DEBOUNCE_MS,
} from './constants.ts'
import { canonicalDirectory, planImports, runImport } from './importer.ts'
import type { WorkspaceTarget } from './importer.ts'
import { dshSessionIdFor, isImportedSessionId } from './mapping.ts'
import type { MappingOptions } from './mapping.ts'
import { defaultOpencodeDbPath, OpencodeDatabase, OpencodeUnavailableError } from './opencode.ts'
import {
  resolveFormatVersion,
  type DomainChange,
  type ImportHostServices,
  type ProjectionCacheLike,
  type SessionEventLike,
  type SessionPersistenceLike,
} from './ports.ts'
import type { ImportReport, ImportStatus, OpencodeSchemaStatus, PreviewSnapshot } from './types.ts'

export { Config }
export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host-side OpenCode session importer exposed through Typert Remote. */
    opencodeImport: OpencodeImportController
  }
}

/** Read one possibly-volatile configuration value. */
function read<T>(value: Volatile<T> | T): T {
  return isVolatile(value) ? ((value as Volatile<T>).get() as T) : (value as T)
}

/** Message text of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Host-side importer service. */
export default class OpencodeImportController extends TypertRemoteService {
  /** The Gateway and every store the import writes through must exist first. */
  static inject = ['typert', 'workspaceRegistry', 'sessionPersistence', 'sessions']

  /** Schemastery schema exposed to the settings mirror. */
  static Config = Config

  private readonly config: ConfigShape
  private report: ImportReport | null = null
  private inflight: Promise<ImportReport> | undefined
  private scanTimer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  constructor(ctx: Context, config: ConfigShape) {
    super(ctx, 'opencodeImport', { namespace: 'opencodeImport' })
    this.config = config
    const logger = ctx.logger('opencode-import')

    ctx.effect(() => {
      const timer = setTimeout(() => {
        if (!read(config.autoScanOnStart)) return
        void this.runScan().catch((error: unknown) => {
          logger.warn(`startup scan failed: ${messageOf(error)}`)
        })
      }, STARTUP_SCAN_DELAY_MS)
      return () => clearTimeout(timer)
    }, 'opencode-import: startup scan')

    ctx.effect(
      () =>
        (ctx as unknown as DomainEventContext).on('domain/changed', (change) => {
          if (change.domain !== 'workspace' || change.operation !== 'put') return
          if (!read(config.scanOnWorkspaceCreate)) return
          this.scheduleScan()
        }),
      'opencode-import: workspace changes',
    )

    ctx.effect(
      () => () => {
        this.disposed = true
        this.clearScanTimer()
      },
      'opencode-import: timers',
    )
  }

  /**
   * Report the database state, the imported session count, and the last scan.
   *
   * @returns a snapshot that never fails the Remote call.
   */
  @Remote
  async status(): Promise<ImportStatus> {
    const dbPath = this.resolveDbPath()
    let schema: OpencodeSchemaStatus = 'missing'
    let dbAvailable = false
    let opencodeSessions = 0
    try {
      const db = OpencodeDatabase.open(dbPath)
      try {
        dbAvailable = true
        schema = 'v2'
        opencodeSessions = db
          .sessions()
          .filter((session) => session.parentId === undefined && !session.archived).length
      } finally {
        db.close()
      }
    } catch (error) {
      schema = error instanceof OpencodeUnavailableError ? error.schema : 'missing'
    }
    return {
      dbPath,
      dbAvailable,
      schema,
      opencodeSessions,
      importedSessions: await this.countImported(),
      scanning: this.inflight !== undefined,
      lastReport: this.report,
    }
  }

  /**
   * Run one import pass now. Concurrent callers share the pass in flight.
   *
   * @returns the completed report.
   */
  @Remote
  async scan(): Promise<ImportReport> {
    return await this.runScan()
  }

  /**
   * List OpenCode sessions with their workspace match and import state.
   *
   * @returns a read-only preview for the settings card.
   */
  @Remote
  async preview(): Promise<PreviewSnapshot> {
    const empty: PreviewSnapshot = { rows: [], unmatchedDirectories: [], truncated: false }
    let db: OpencodeDatabase
    try {
      db = OpencodeDatabase.open(this.resolveDbPath())
    } catch {
      return empty
    }
    try {
      const byDirectory = new Map<string, string>()
      for (const workspace of this.host.workspaceRegistry.list()) {
        byDirectory.set(canonicalDirectory(workspace.path), workspace.path)
      }
      const imported = await this.importedIds()
      const counts = db.messageCounts()
      const rows = db
        .sessions()
        .filter((session) => session.parentId === undefined && !session.archived)
        .map((session) => {
          const dshSessionId = dshSessionIdFor(session.id)
          return {
            opencodeSessionId: session.id,
            dshSessionId,
            title: session.title,
            directory: session.directory,
            workspacePath: byDirectory.get(canonicalDirectory(session.directory)) ?? null,
            timeUpdated: session.timeUpdated,
            messageCount: counts.get(session.id) ?? 0,
            imported: imported.has(dshSessionId),
          }
        })
        // oxlint-disable-next-line unicorn/no-array-sort -- sorting the fresh projection, not shared state
        .sort((left, right) => right.timeUpdated - left.timeUpdated)
      const unmatchedDirectories = [
        ...new Set(
          rows
            .filter((row) => row.workspacePath === null)
            .map((row) => canonicalDirectory(row.directory)),
        ),
      ]
      return {
        rows: rows.slice(0, PREVIEW_LIMIT),
        unmatchedDirectories,
        truncated: rows.length > PREVIEW_LIMIT,
      }
    } finally {
      db.close()
    }
  }

  /** The Host services this plugin writes through. */
  private get host(): ImportHostServices {
    return this.ctx as unknown as ImportHostServices
  }

  /** Run one pass, reusing the one already in flight. */
  private runScan(): Promise<ImportReport> {
    if (this.inflight !== undefined) return this.inflight
    const run = this.executeScan().finally(() => {
      if (this.inflight === run) this.inflight = undefined
    })
    this.inflight = run
    return run
  }

  /** Execute one full pass and record its report. */
  private async executeScan(): Promise<ImportReport> {
    const config = this.readConfig()
    const dbPath = this.resolveDbPath()
    const startedAt = Date.now()
    const workspaces = this.workspaces()
    const report: ImportReport = {
      startedAt,
      finishedAt: startedAt,
      dbPath,
      dbAvailable: false,
      schema: 'missing',
      workspaces: workspaces.length,
      discovered: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      unmatchedSessions: 0,
      unmatchedDirectories: [],
      errors: [],
    }
    let db: OpencodeDatabase
    try {
      db = OpencodeDatabase.open(dbPath)
    } catch (error) {
      if (error instanceof OpencodeUnavailableError) report.schema = error.schema
      this.recordError(report, messageOf(error))
      report.finishedAt = Date.now()
      this.report = report
      return report
    }
    report.dbAvailable = true
    report.schema = 'v2'
    try {
      const persistence = this.host.sessionPersistence
      const formatVersion = await resolveFormatVersion(persistence)
      const sessions = db.sessions()
      const planned = planImports(sessions, workspaces, config.excludedDirectories)
      report.discovered = planned.plans.length
      report.unmatchedSessions = planned.unmatchedSessions
      report.unmatchedDirectories = planned.unmatchedDirectories
      const mapping: MappingOptions = {
        includeToolCalls: config.includeToolCalls,
        includeReasoning: config.includeReasoning,
        maxMessages: config.maxMessages,
      }
      const outcome = await runImport(
        planned.plans,
        {
          isImported: async (dshSessionId) =>
            (await persistence.stat(dshSessionId)) !== undefined,
          write: async (header, events) => {
            await this.writeSession(persistence, header, events)
          },
          warm: async (dshSessionId, events, header) => {
            await this.warmProjection(dshSessionId, events, header)
          },
          loadMessages: (opencodeSessionId) => db.messages(opencodeSessionId),
          attach: async (workspace, dshSessionId) => {
            await workspace.attach(dshSessionId)
          },
        },
        formatVersion,
        mapping,
        MAX_REPORT_ERRORS,
      )
      report.imported = outcome.imported
      report.skipped = outcome.skipped
      report.failed = outcome.failed
      report.errors.push(...outcome.errors)
    } catch (error) {
      this.recordError(report, messageOf(error))
    } finally {
      db.close()
    }
    report.finishedAt = Date.now()
    this.report = report
    return report
  }

  /** Write one complete session log in a single append batch. */
  private async writeSession(
    persistence: SessionPersistenceLike,
    header: Record<string, unknown>,
    events: readonly SessionEventLike[],
  ): Promise<void> {
    const handle = await persistence.create(header)
    try {
      await handle.append(events)
      await handle.flush()
    } finally {
      await handle.close()
    }
  }

  /**
   * Checkpoint the imported session's projections so the sidebar list shows the
   * OpenCode title instead of "Untitled" before the session is ever opened.
   */
  private async warmProjection(
    dshSessionId: string,
    events: readonly SessionEventLike[],
    header: Record<string, unknown>,
  ): Promise<void> {
    const cache = (this.ctx as unknown as { get(name: string): unknown }).get(
      'sessionProjectionCache',
    ) as ProjectionCacheLike | undefined
    if (cache === undefined) return
    try {
      const session = this.host.sessions.prepare(dshSessionId, {
        seed: [...events],
        meta: {
          cwd: header.cwd as string,
          createdAt: header.createdAt as number,
        },
      })
      await cache.write(session)
    } catch (error) {
      this.ctx
        .logger('opencode-import')
        .warn(`projection cache warm failed for ${dshSessionId}: ${messageOf(error)}`)
    }
  }

  /** Count DSH sessions this plugin minted. */
  private async countImported(): Promise<number> {
    try {
      const snapshots = await this.host.sessionPersistence.list()
      return snapshots.filter((snapshot) => isImportedSessionId(snapshot.header.id)).length
    } catch {
      return 0
    }
  }

  /** Identities of every DSH session this plugin minted. */
  private async importedIds(): Promise<Set<string>> {
    try {
      const snapshots = await this.host.sessionPersistence.list()
      return new Set(
        snapshots.map((snapshot) => snapshot.header.id).filter((id) => isImportedSessionId(id)),
      )
    } catch {
      return new Set()
    }
  }

  /** Registered workspaces as attach targets. */
  private workspaces(): WorkspaceTarget[] {
    return this.host.workspaceRegistry.list().map((workspace) => ({
      id: String(workspace.id),
      path: workspace.path,
      attach: async (sessionId: string) => {
        await workspace.attachSession(sessionId)
      },
    }))
  }

  /** Resolve the database path from configuration or platform defaults. */
  private resolveDbPath(): string {
    const configured = read(this.config.dbPath).trim()
    return configured.length > 0 ? configured : defaultOpencodeDbPath()
  }

  /** Snapshot every configuration value once per pass. */
  private readConfig(): {
    includeToolCalls: boolean
    includeReasoning: boolean
    maxMessages: number
    excludedDirectories: string[]
  } {
    return {
      includeToolCalls: read(this.config.includeToolCalls),
      includeReasoning: read(this.config.includeReasoning),
      maxMessages: Math.max(0, Math.floor(read(this.config.maxMessagesPerSession))),
      excludedDirectories: read(this.config.excludedDirectories).filter(
        (entry) => typeof entry === 'string' && entry.length > 0,
      ),
    }
  }

  /** Keep one failure line, bounded. */
  private recordError(report: ImportReport, line: string): void {
    if (report.errors.length < MAX_REPORT_ERRORS) report.errors.push(line)
  }

  /** Debounced scan used by workspace-registry changes. */
  private scheduleScan(): void {
    if (this.disposed) return
    this.clearScanTimer()
    this.scanTimer = setTimeout(() => {
      this.scanTimer = undefined
      void this.runScan().catch(() => {
        // executeScan folds failures into the report; nothing else to do here.
      })
    }, WORKSPACE_SCAN_DEBOUNCE_MS)
  }

  /** Drop a pending debounced scan. */
  private clearScanTimer(): void {
    if (this.scanTimer === undefined) return
    clearTimeout(this.scanTimer)
    this.scanTimer = undefined
  }
}

/** Minimal Cordis event surface used by the workspace-change listener. */
interface DomainEventContext {
  on(name: 'domain/changed', listener: (change: DomainChange) => void): () => void
}
