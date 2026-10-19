/**
 * Wire types shared by the Host and the browser half.
 *
 * Every type reachable from an `@Remote` method lives here so the Typert
 * generator can publish it under `@hmilyld/dsh-ocgo-usage-dock/types` and the
 * generated client contribution can import the same declaration.
 */

/** One usage window as the dock renders it. */
export interface UsageWindow {
  /** Stable id: `rolling`, `weekly`, or `monthly`. */
  id: string
  /** Used percentage in the 0–100 range, or null when the endpoint omitted it. */
  percent: number | null
  /** Provider-reported status, or `unknown` when absent. */
  status: string
  /** Absolute ISO-8601 reset time when the endpoint reported one. */
  resetsAt?: string
  /** Seconds until reset when the endpoint reported a relative value. */
  resetInSec?: number
}

/** Complete answer of one usage read. */
export interface UsageSnapshot {
  /** `ok`, `no-key`, or `error`. */
  status: string
  /** Human-readable failure code when `status` is `error`. */
  error?: string
  /** ISO-8601 time at which the Host produced this answer. */
  updatedAt: string
  /**
   * Whether the deprecated `apiKey` setting still holds a value. The client
   * shows a migration notice instead of ever reading the secret.
   */
  legacyApiKey: boolean
  /** The three windows in display order. */
  windows: UsageWindow[]
}
