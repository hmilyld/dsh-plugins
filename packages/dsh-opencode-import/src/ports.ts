/**
 * Structural views of the Host services this plugin writes through.
 *
 * The plugin deliberately does not import the DSH session packages: their
 * ambient `TypertLookupMap` augmentation trips the Typert generator when it is
 * pulled into this package's type graph. These ports describe exactly the
 * surface used here, and the tests validate the produced events against the
 * real `Session` implementation instead.
 */

/** One appendable session event, structurally. */
export interface SessionEventLike {
  type: string
  seq: number
  time: number
  data: unknown
  surfaceOp?: 'append' | { op: 'replace'; startSeq: number; endSeq: number }
  sourceEventSeqs?: number[]
  ignorable?: true
}

/** One open write handle over a stored session. */
export interface SessionHandleLike {
  append(events: readonly SessionEventLike[]): Promise<void>
  flush(): Promise<void>
  close(): Promise<void>
}

/** One stored session as the listing reads it (header only). */
export interface StoredSessionLike {
  header: { id: string; version: number }
}

/** Durable session storage. */
export interface SessionPersistenceLike {
  create(header: Record<string, unknown>): Promise<SessionHandleLike>
  stat(id: string): Promise<unknown>
  list(): Promise<readonly StoredSessionLike[]>
}

/** The in-memory session store. */
export interface SessionsLike {
  prepare(
    id: string,
    options: {
      seed: readonly SessionEventLike[]
      meta: { cwd: string; createdAt: number }
    },
  ): unknown
}

/** Persisted projection checkpoints. */
export interface ProjectionCacheLike {
  write(session: unknown): Promise<void>
}

/** One registered workspace. */
export interface WorkspaceLike {
  id: string
  path: string
  attachSession(id: string): Promise<void>
}

/** The durable workspace registry. */
export interface WorkspaceRegistryLike {
  list(): readonly WorkspaceLike[]
}

/** The Host services this plugin requires, viewed structurally. */
export interface ImportHostServices {
  sessionPersistence: SessionPersistenceLike
  sessions: SessionsLike
  workspaceRegistry: WorkspaceRegistryLike
}

/** One `domain/changed` notification. */
export interface DomainChange {
  domain: string
  table: string
  key: string
  operation: 'put' | 'deleted'
}

/** Fallback session format version when nothing else can be observed. */
export const FALLBACK_SESSION_FORMAT_VERSION = 4

/**
 * Read the session format version the running store actually uses.
 *
 * A stored header is authoritative; a deployment with no sessions at all falls
 * back to the loaded package's constant, and finally to the pinned fallback.
 *
 * @param persistence - durable session storage.
 * @returns the format version to stamp on new headers.
 */
export async function resolveFormatVersion(
  persistence: SessionPersistenceLike,
): Promise<number> {
  try {
    const stored = await persistence.list()
    for (const snapshot of stored) {
      const version = snapshot.header?.version
      if (typeof version === 'number' && Number.isFinite(version)) return version
    }
  } catch {
    // A listing failure must not block the import; fall through to the constant.
  }
  try {
    const specifier = '@deepseek-ai/dsh-session'
    const loaded = (await import(specifier)) as { SESSION_FORMAT_VERSION?: unknown }
    if (typeof loaded.SESSION_FORMAT_VERSION === 'number') return loaded.SESSION_FORMAT_VERSION
  } catch {
    // The package is optional for this plugin; the fallback keeps it working.
  }
  return FALLBACK_SESSION_FORMAT_VERSION
}
