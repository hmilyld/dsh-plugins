/** Planning and execution of one import pass. */
import { realpathSync } from 'node:fs'
import { sep } from 'node:path'
import { dshSessionIdFor, mapSession, type MappingOptions } from './mapping.ts'
import type { OpencodeMessage, OpencodeSession } from './opencode.ts'
import type { SessionEventLike } from './ports.ts'

/** One registered workspace this plugin may attach sessions to. */
export interface WorkspaceTarget {
  /** Workspace identity. */
  id: string
  /** Canonical workspace directory. */
  path: string
  /** Prepend a session to this workspace's account. */
  attach(sessionId: string): Promise<void>
}

/** One session matched to a workspace. */
export interface ImportPlan {
  session: OpencodeSession
  workspace: WorkspaceTarget
}

/** Candidate selection result. */
export interface PlanResult {
  /** Sessions to import, oldest first so the newest ends up on top. */
  plans: ImportPlan[]
  /** Directories with sessions but no registered workspace, newest first. */
  unmatchedDirectories: string[]
  /** Count of root sessions that matched no workspace. */
  unmatchedSessions: number
}

/** Resolve a path to its canonical form, falling back to the raw value. */
export function canonicalDirectory(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Whether a directory is the excluded path or one of its descendants. */
function isExcluded(directory: string, excluded: readonly string[]): boolean {
  for (const entry of excluded) {
    if (entry.length === 0) continue
    if (directory === entry || directory.startsWith(entry.endsWith(sep) ? entry : `${entry}${sep}`)) {
      return true
    }
  }
  return false
}

/**
 * Match root OpenCode sessions to registered workspaces by canonical directory.
 *
 * Child sessions and archived sessions are excluded: OpenCode children are its
 * own subagent routing, and archived rows are hidden in OpenCode itself.
 *
 * @param sessions - every session read from OpenCode.
 * @param workspaces - registered DSH workspaces.
 * @param excludedDirectories - directories whose sessions are never imported.
 * @returns matched plans plus the unmatched directories for the report.
 */
export function planImports(
  sessions: readonly OpencodeSession[],
  workspaces: readonly WorkspaceTarget[],
  excludedDirectories: readonly string[] = [],
): PlanResult {
  const byDirectory = new Map<string, WorkspaceTarget>()
  for (const workspace of workspaces) {
    byDirectory.set(canonicalDirectory(workspace.path), workspace)
  }
  const excluded = excludedDirectories.map((entry) => canonicalDirectory(entry))
  const plans: ImportPlan[] = []
  const unmatched = new Map<string, number>()
  let unmatchedSessions = 0
  for (const session of sessions) {
    if (session.parentId !== undefined || session.archived) continue
    const directory = canonicalDirectory(session.directory)
    if (isExcluded(directory, excluded)) continue
    const workspace = byDirectory.get(directory)
    if (workspace === undefined) {
      unmatchedSessions += 1
      unmatched.set(directory, Math.max(unmatched.get(directory) ?? 0, session.timeUpdated))
      continue
    }
    plans.push({ session, workspace })
  }
  plans.sort((left, right) => left.session.timeCreated - right.session.timeCreated)
  const unmatchedDirectories = [...unmatched.entries()]
    // oxlint-disable-next-line unicorn/no-array-sort -- sorting the fresh entry copy, not shared state
    .sort((left, right) => right[1] - left[1])
    .map(([directory]) => directory)
  return { plans, unmatchedDirectories, unmatchedSessions }
}

/** Storage operations one import pass needs. */
export interface ImportPorts {
  /** Whether the DSH session already exists. */
  isImported(dshSessionId: string): Promise<boolean>
  /** Create the stored session and append its complete event log. */
  write(header: Record<string, unknown>, events: readonly SessionEventLike[]): Promise<void>
  /** Warm the projection cache so list rows carry the imported title. */
  warm(dshSessionId: string, events: readonly SessionEventLike[], header: Record<string, unknown>): Promise<void>
  /** Read one OpenCode session's stored events. */
  loadMessages(opencodeSessionId: string): OpencodeMessage[]
  /** Attach the stored session to its workspace. */
  attach(workspace: WorkspaceTarget, dshSessionId: string): Promise<void>
}

/** Per-pass counters and bounded failure lines. */
export interface ImportOutcome {
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

/** Build the header stored for one imported session. */
export function headerFor(
  formatVersion: number,
  session: OpencodeSession,
  workspace: WorkspaceTarget,
): Record<string, unknown> {
  return {
    version: formatVersion,
    id: dshSessionIdFor(session.id),
    createdAt: session.timeCreated,
    cwd: workspace.path,
    isSeeded: false,
  }
}

/** Record one failure line, bounded by `limit`. */
function recordError(outcome: ImportOutcome, limit: number, line: string): void {
  if (outcome.errors.length < limit) outcome.errors.push(line)
}

/**
 * Import every planned session, one at a time.
 *
 * A failure is contained to its own session: the pass keeps going so one
 * unreadable conversation cannot hide the rest.
 *
 * @param plans - matched sessions, oldest first.
 * @param ports - storage operations.
 * @param formatVersion - current DSH session format version.
 * @param options - mapping options.
 * @param errorLimit - maximum failure lines kept.
 * @returns counters for the scan report.
 */
export async function runImport(
  plans: readonly ImportPlan[],
  ports: ImportPorts,
  formatVersion: number,
  options: MappingOptions,
  errorLimit: number,
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { imported: 0, skipped: 0, failed: 0, errors: [] }
  for (const plan of plans) {
    const dshSessionId = dshSessionIdFor(plan.session.id)
    try {
      if (await ports.isImported(dshSessionId)) {
        outcome.skipped += 1
        continue
      }
      const rows = ports.loadMessages(plan.session.id)
      const mapping = mapSession(plan.session, rows, options)
      if (mapping.events.length === 0) {
        outcome.skipped += 1
        continue
      }
      const header = headerFor(formatVersion, plan.session, plan.workspace)
      await ports.write(header, mapping.events)
      await ports.warm(dshSessionId, mapping.events, header)
      await ports.attach(plan.workspace, dshSessionId)
      outcome.imported += 1
    } catch (error) {
      outcome.failed += 1
      recordError(
        outcome,
        errorLimit,
        `${plan.session.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  return outcome
}
