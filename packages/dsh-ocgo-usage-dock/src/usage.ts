/**
 * Pure host-side usage logic: configuration unwrapping, credential resolution,
 * endpoint normalization, and the one network call.
 *
 * Everything here is free of Cordis services so the smoke test can exercise the
 * behaviour that matters (key precedence, cache fingerprints, response shape)
 * without booting a Host.
 */
import { isVolatile } from '@deepseek-ai/cosmokit'
import { credentialRef, isCredentialRefName } from '@deepseek-ai/dsh-credentials'
import type CredentialProvider from '@deepseek-ai/dsh-credentials'
import type { Volatile } from '@deepseek-ai/cordis'
import type { Config } from './config.ts'
import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_BASE_URL,
  DEFAULT_REFRESH_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  MIN_REFRESH_INTERVAL_MS,
  MIN_TIMEOUT_MS,
} from './constants.ts'
import type { UsageSnapshot, UsageWindow } from './types.ts'

/** Environment names consulted after `apiKeyEnv` for old deployments. */
export const FALLBACK_ENV_KEYS = ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY'] as const

/** Browser-shaped user agent; the dashboard rejects some default client UAs. */
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** Unwrapped configuration with every value already validated and clamped. */
export interface ResolvedConfig {
  apiKey: string
  apiKeyEnv: string
  refreshIntervalMs: number
  timeoutMs: number
  baseUrl: string
}

/** One usable API key and the layer that supplied it. */
export interface ResolvedKey {
  source: string
  value: string
}

/** A cache entry's identity, never the secret itself. */
export interface KeyFingerprint {
  source: string
  hash: string
}

/** Read a field that may be live-wrapped by the Loader. */
function read<T>(value: Volatile<T> | T): T {
  return isVolatile(value) ? ((value as Volatile<T>).get() as T) : (value as T)
}

/** Coerce a numeric setting into its accepted range. */
function clamp(value: number, min: number, fallback: number): number {
  return Number.isFinite(value) && value >= min ? Math.trunc(value) : fallback
}

/** Read the live configuration, applying the schema's documented defaults. */
export function readConfig(config: Config): ResolvedConfig {
  return {
    apiKey: read(config.apiKey).trim(),
    apiKeyEnv: read(config.apiKeyEnv).trim() || DEFAULT_API_KEY_ENV,
    refreshIntervalMs: clamp(
      read(config.refreshIntervalMs),
      MIN_REFRESH_INTERVAL_MS,
      DEFAULT_REFRESH_INTERVAL_MS,
    ),
    timeoutMs: clamp(read(config.timeoutMs), MIN_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    baseUrl: read(config.baseUrl).trim() || DEFAULT_BASE_URL,
  }
}

/** Whether the deprecated literal is still configured. */
export function hasLegacyKey(config: ResolvedConfig): boolean {
  return config.apiKey.length > 0
}

/** Non-cryptographic fingerprint so the cache can spot a rotated key without retaining it. */
export function keyFingerprint(key: ResolvedKey): KeyFingerprint {
  const input = `${key.source}\u0000${key.value}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return { source: key.source, hash: hash.toString(16) }
}

/**
 * Resolve the key in the order that keeps existing profiles working:
 *
 * 1. the deprecated `apiKey` literal,
 * 2. `process.env[apiKeyEnv]`,
 * 3. the historical `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY` names,
 * 4. the Host credentials domain through `apiKeyEnv`.
 */
export async function resolveApiKey(
  config: ResolvedConfig,
  credentials: CredentialProvider | undefined,
): Promise<ResolvedKey | undefined> {
  if (config.apiKey.length > 0) return { source: 'config', value: config.apiKey }

  const direct = process.env[config.apiKeyEnv]
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return { source: config.apiKeyEnv, value: direct.trim() }
  }

  for (const name of FALLBACK_ENV_KEYS) {
    if (name === config.apiKeyEnv) continue
    const value = process.env[name]
    if (typeof value === 'string' && value.trim().length > 0) {
      return { source: name, value: value.trim() }
    }
  }

  if (credentials !== undefined && isCredentialRefName(config.apiKeyEnv)) {
    const resolved = await credentials.resolve(credentialRef(config.apiKeyEnv))
    const value = resolved?.value?.trim()
    if (value !== undefined && value.length > 0) {
      return { source: 'credentials', value }
    }
  }

  return undefined
}

/** Read one window from either documented response shape. */
function normalizeWindow(input: unknown): UsageWindow | undefined {
  if (input === null || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  const rawPercent = record.percent ?? record.usagePercent
  const percent =
    typeof rawPercent === 'number' && Number.isFinite(rawPercent)
      ? Math.min(100, Math.max(0, rawPercent))
      : null
  const status = typeof record.status === 'string' && record.status.length > 0 ? record.status : 'unknown'
  const window: UsageWindow = { id: '', percent, status }
  const resetsAt = record.resetsAt ?? record.resets_at
  if (typeof resetsAt === 'string' && resetsAt.length > 0) window.resetsAt = resetsAt
  const resetInSec = record.resetInSec ?? record.reset_in_sec
  if (typeof resetInSec === 'number' && Number.isFinite(resetInSec)) window.resetInSec = resetInSec
  return window
}

/**
 * Fold both response shapes into the dock's three fixed windows:
 *
 * - the documented `{ rollingUsage, weeklyUsage, monthlyUsage }`, and
 * - the deployed `{ usage: { rolling, weekly, monthly } }`.
 */
export function normalizeUsageShape(data: unknown): UsageWindow[] {
  const root = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const nested =
    root.usage !== null && typeof root.usage === 'object'
      ? (root.usage as Record<string, unknown>)
      : root

  const shapes: ReadonlyArray<readonly [string, unknown]> = [
    ['rolling', nested.rolling ?? root.rollingUsage],
    ['weekly', nested.weekly ?? root.weeklyUsage],
    ['monthly', nested.monthly ?? root.monthlyUsage],
  ]

  return shapes.map(([id, value]) => {
    const window = normalizeWindow(value)
    return window === undefined ? { id, percent: null, status: 'unknown' } : { ...window, id }
  })
}

/** Snapshot used when no key can be resolved. */
export function emptySnapshot(config: ResolvedConfig, status: string, error?: string): UsageSnapshot {
  const snapshot: UsageSnapshot = {
    status,
    updatedAt: new Date().toISOString(),
    legacyApiKey: hasLegacyKey(config),
    windows: [],
  }
  if (error !== undefined) snapshot.error = error
  return snapshot
}

/** Perform one usage request and fold every failure into a snapshot. */
export async function requestUsage(
  config: ResolvedConfig,
  key: ResolvedKey,
  fetchImpl: typeof fetch = fetch,
): Promise<UsageSnapshot> {
  try {
    const response = await fetchImpl(config.baseUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key.value}`,
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    })
    if (!response.ok) {
      return emptySnapshot(config, 'error', `http-${response.status}`)
    }
    const data: unknown = await response.json()
    return {
      status: 'ok',
      updatedAt: new Date().toISOString(),
      legacyApiKey: hasLegacyKey(config),
      windows: normalizeUsageShape(data),
    }
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return emptySnapshot(config, 'error', timeout ? 'timeout' : 'network')
  }
}
