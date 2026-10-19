/**
 * Host half of `@hmilyld/dsh-ocgo-usage-dock`.
 *
 * The plugin is a Typert Remote service: the browser half calls `snapshot()`
 * through the generated Remote contribution, and the Host owns credential
 * resolution, the usage request, and the short-lived cache. No DOM, settings,
 * or network details leak across the wire.
 *
 * `TypertRemoteService` registers the Cordis service `ocgoUsage`; the Typert
 * loader discovers `lib/typert.host.js` from the package export and binds the
 * generated reflection to this same key.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { Config } from './config.ts'
import type { UsageSnapshot } from './types.ts'
import {
  emptySnapshot,
  keyFingerprint,
  readConfig,
  requestUsage,
  resolveApiKey,
} from './usage.ts'
import type { KeyFingerprint, ResolvedConfig, ResolvedKey } from './usage.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host-side OpenCode Go usage controller exposed through Typert Remote. */
    ocgoUsage: OcgoUsageController
  }
}

interface CacheEntry {
  fingerprint: KeyFingerprint
  baseUrl: string
  fetchedAt: number
  snapshot: UsageSnapshot
}

/** Host-side Remote controller for the OpenCode Go usage dock. */
export default class OcgoUsageController extends TypertRemoteService {
  /** The Gateway must exist before the generated reflection can bind. */
  static inject = ['typert']

  /** Schemastery schema exposed to the settings mirror. */
  static Config = Config

  private readonly config: Config
  private cache: CacheEntry | undefined
  private inflight: { promise: Promise<UsageSnapshot>; force: boolean } | undefined

  constructor(ctx: Context, config: Config) {
    super(ctx, 'ocgoUsage', { namespace: 'ocgoUsage' })
    this.config = config
  }

  /**
   * Return the current usage, refreshing from the endpoint when the cache is
   * stale or `force` is set. Concurrent callers share one request.
   *
   * @param force - bypass the interval cache (manual refresh / after a save).
   * @returns a complete snapshot; failures are values, not thrown errors.
   */
  @Remote
  async snapshot(force: boolean): Promise<UsageSnapshot> {
    const config = readConfig(this.config)
    const credentials = this.ctx.get('credentials')
    const key = await resolveApiKey(config, credentials)
    if (key === undefined) return emptySnapshot(config, 'no-key')

    const fingerprint = keyFingerprint(key)
    const cached = this.cache
    const fresh =
      cached !== undefined &&
      cached.baseUrl === config.baseUrl &&
      cached.fingerprint.source === fingerprint.source &&
      cached.fingerprint.hash === fingerprint.hash &&
      Date.now() - cached.fetchedAt < config.refreshIntervalMs
    if (!force && fresh) return cached.snapshot

    // A non-forced read joins the request in flight. A forced read waits for it
    // and then starts a fresh one, so a key saved during a poll is not masked by
    // the poll's old configuration.
    if (this.inflight !== undefined) {
      if (!force) return this.inflight.promise
      // A forced call that finds a forced request in flight shares it. A forced
      // call that finds a normal poll waits for it, then starts a fresh one so
      // a key saved mid-poll is not masked by the poll's old configuration.
      if (this.inflight.force) return this.inflight.promise
      await this.inflight.promise
      if (this.inflight !== undefined) return this.inflight.promise
    }

    const run = this.load(config, key, fingerprint)
    const entry = { promise: run, force }
    this.inflight = entry
    try {
      return await run
    } finally {
      if (this.inflight === entry) this.inflight = undefined
    }
  }

  /** Resolve delivery failure into an error snapshot rather than breaking the Remote call. */
  private async load(
    config: ResolvedConfig,
    key: ResolvedKey,
    fingerprint: KeyFingerprint,
  ): Promise<UsageSnapshot> {
    const snapshot = await requestUsage(config, key)
    this.cache = {
      fingerprint,
      baseUrl: config.baseUrl,
      fetchedAt: Date.now(),
      snapshot,
    }
    return snapshot
  }
}
