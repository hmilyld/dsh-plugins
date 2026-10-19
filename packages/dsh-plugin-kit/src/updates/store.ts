/** Browser-side npm registry update check with a persistent cache. */
import { isNewerVersion } from './version.ts'
import type { UpdateStatus, UpdateStore } from './types.ts'

/** How long a registry answer is trusted (six hours). */
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000

/** Per-package cache namespace, versioned so a shape change cannot be misread. */
const CACHE_PREFIX = 'dsh-plugin-kit:updates:v1:'

/** One cached registry answer. */
interface CacheRecord {
  latestVersion: string
  checkedAt: number
}

/** Options accepted by {@link createUpdateStore}. */
export interface UpdateStoreOptions {
  /** Package name as published on npm, including the scope. */
  packageName: string
  /** Version the running bundle was built from. */
  currentVersion: string
  /** Registry base; defaults to `https://registry.npmjs.org`. */
  registry?: string
  /** Freshness window for cached answers. */
  intervalMs?: number
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch
  /** Injectable storage; pass null to disable persistence. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  /** Injectable clock for tests. */
  now?: () => number
}

/** A store that checks one package and publishes the result to subscribers. */
export function createUpdateStore(options: UpdateStoreOptions): UpdateStore {
  const registry = (options.registry ?? 'https://registry.npmjs.org').replace(/\/+$/, '')
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const now = options.now ?? ((): number => Date.now())
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const cacheKey = `${CACHE_PREFIX}${options.packageName}`
  const listeners = new Set<() => void>()
  let state: UpdateStatus = {
    packageName: options.packageName,
    currentVersion: options.currentVersion,
    latestVersion: null,
    updateAvailable: false,
    checkedAt: null,
    error: null,
  }
  let inflight: Promise<void> | undefined

  const cached = readRecord()
  if (cached !== null && now() - cached.checkedAt <= intervalMs) {
    const latestVersion = cached.latestVersion === '' ? null : cached.latestVersion
    state = {
      ...state,
      latestVersion,
      updateAvailable:
        latestVersion !== null && isNewerVersion(latestVersion, options.currentVersion),
      checkedAt: cached.checkedAt,
    }
  }

  /** Read the persisted answer regardless of its age. */
  function readRecord(): CacheRecord | null {
    if (storage === null) return null
    try {
      const raw = storage.getItem(cacheKey)
      if (raw === null) return null
      const parsed: unknown = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object') return null
      const record = parsed as Record<string, unknown>
      if (typeof record.latestVersion !== 'string' || typeof record.checkedAt !== 'number') return null
      return { latestVersion: record.latestVersion, checkedAt: record.checkedAt }
    } catch {
      return null
    }
  }

  /** Persist one answer, ignoring quota or privacy-mode failures. */
  function writeRecord(record: CacheRecord): void {
    if (storage === null) return
    try {
      storage.setItem(cacheKey, JSON.stringify(record))
    } catch {
      // A full or unavailable store only costs the next refresh.
    }
  }

  /** Publish a new state to every subscriber. */
  function publish(next: UpdateStatus): void {
    state = next
    // Snapshot first: a listener may unsubscribe while being notified.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const listener of [...listeners]) listener()
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh: async (force = false) => {
      if (inflight !== undefined) return inflight
      const record = readRecord()
      if (!force && record !== null && now() - record.checkedAt <= intervalMs) {
        const latestVersion = record.latestVersion === '' ? null : record.latestVersion
        const updateAvailable =
          latestVersion !== null && isNewerVersion(latestVersion, options.currentVersion)
        if (
          state.latestVersion !== latestVersion ||
          state.updateAvailable !== updateAvailable ||
          state.checkedAt !== record.checkedAt
        ) {
          publish({
            ...state,
            latestVersion,
            updateAvailable,
            checkedAt: record.checkedAt,
            error: null,
          })
        }
        return
      }
      const run = (async () => {
        try {
          const latestVersion = await fetchLatest(fetchImpl, registry, options.packageName)
          const checkedAt = now()
          writeRecord({ latestVersion: latestVersion ?? '', checkedAt })
          publish({
            ...state,
            latestVersion,
            updateAvailable:
              latestVersion !== null && isNewerVersion(latestVersion, options.currentVersion),
            checkedAt,
            error: null,
          })
        } catch (error) {
          publish({ ...state, error: error instanceof Error ? error.message : String(error) })
        } finally {
          inflight = undefined
        }
      })()
      inflight = run
      return run
    },
  }
}

/** Ask the registry for one package's `latest` dist-tag version, or null when the package is unpublished. */
async function fetchLatest(
  fetchImpl: typeof fetch,
  registry: string,
  packageName: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, 8000)
  try {
    const encoded = packageName.replace('/', '%2F')
    const response = await fetchImpl(`${registry}/${encoded}/latest`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`http-${response.status}`)
    const data: unknown = await response.json()
    const version =
      data !== null && typeof data === 'object'
        ? (data as Record<string, unknown>).version
        : undefined
    if (typeof version !== 'string' || version.length === 0) throw new Error('invalid-response')
    return version
  } finally {
    clearTimeout(timer)
  }
}

/** The browser storage to persist answers in, when one exists. */
function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  // The update store is browser-only; avoiding `localStorage` outside a window
  // also keeps Node's experimental localStorage from warning during tests.
  if (typeof window === 'undefined') return null
  try {
    return localStorage
  } catch {
    return null
  }
}
