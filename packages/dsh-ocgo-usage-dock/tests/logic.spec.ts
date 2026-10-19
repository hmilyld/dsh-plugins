import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  keyFingerprint,
  normalizeUsageShape,
  readConfig,
  requestUsage,
  resolveApiKey,
} from '../src/usage.ts'
import type { Config } from '../src/config.ts'

function config(overrides: Partial<Record<keyof Config, unknown>> = {}): Config {
  return {
    apiKey: '',
    apiKeyEnv: 'OPENCODE_GO_API_KEY',
    refreshIntervalMs: 60_000,
    timeoutMs: 1_000,
    baseUrl: 'https://example.test/usage',
    ...overrides,
  } as Config
}

const ENV_KEYS = ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY', 'OCGO_TEST_KEY']
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('configuration', () => {
  it('applies defaults and clamps unsafe values', () => {
    const resolved = readConfig(config({ apiKeyEnv: '  ', refreshIntervalMs: 1, timeoutMs: 0, baseUrl: '  ' }))
    expect(resolved.apiKeyEnv).toBe('OPENCODE_GO_API_KEY')
    expect(resolved.refreshIntervalMs).toBe(300_000)
    expect(resolved.timeoutMs).toBe(15_000)
    expect(resolved.baseUrl).toBe('https://opencode.ai/zen/go/v1/usage')
  })
})

describe('response normalization', () => {
  it('folds both documented shapes', () => {
    const nested = normalizeUsageShape({
      usage: {
        rolling: { status: 'ok', percent: 42, resetsAt: '2026-10-19T12:00:00Z' },
        weekly: { status: 'warning', usagePercent: 70 },
        monthly: { status: 'critical', percent: 95, resetInSec: 3600 },
      },
    })
    expect(nested.map((window) => [window.id, window.percent, window.status])).toEqual([
      ['rolling', 42, 'ok'],
      ['weekly', 70, 'warning'],
      ['monthly', 95, 'critical'],
    ])
    expect(nested[0]?.resetsAt).toBe('2026-10-19T12:00:00Z')
    expect(nested[2]?.resetInSec).toBe(3600)

    const flat = normalizeUsageShape({
      rollingUsage: { percent: 1.5 },
      weeklyUsage: { usagePercent: 101 },
      monthlyUsage: { percent: -3 },
    })
    expect(flat.map((window) => window.percent)).toEqual([1.5, 100, 0])

    const missing = normalizeUsageShape({})
    expect(missing).toHaveLength(3)
    expect(missing.every((window) => window.percent === null)).toBe(true)
  })
})

describe('credential precedence', () => {
  it('uses config, apiKeyEnv, legacy env, then credentials', async () => {
    const credentials = { resolve: async () => ({ value: 'from-store' }) }
    expect(await resolveApiKey(config({ apiKey: 'literal', apiKeyEnv: 'OCGO_TEST_KEY' }), credentials as never)).toEqual({
      source: 'config',
      value: 'literal',
    })
    process.env.OCGO_TEST_KEY = 'from-env'
    expect(await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), credentials as never)).toEqual({
      source: 'OCGO_TEST_KEY',
      value: 'from-env',
    })
    delete process.env.OCGO_TEST_KEY
    process.env.OPENCODE_API_KEY = 'legacy-env'
    expect(await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), credentials as never)).toEqual({
      source: 'OPENCODE_API_KEY',
      value: 'legacy-env',
    })
    delete process.env.OPENCODE_API_KEY
    expect(await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), credentials as never)).toEqual({
      source: 'credentials',
      value: 'from-store',
    })
    expect(await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), undefined)).toBeUndefined()
  })

  it('fingerprints the key without retaining it', () => {
    const first = keyFingerprint({ source: 'credentials', value: 'secret-a' })
    expect(first).toEqual(keyFingerprint({ source: 'credentials', value: 'secret-a' }))
    expect(first).not.toEqual(keyFingerprint({ source: 'credentials', value: 'secret-b' }))
    expect(JSON.stringify(first)).not.toContain('secret-a')
  })
})

describe('usage request', () => {
  it('folds success, HTTP failure, timeout, and network errors', async () => {
    const original = globalThis.fetch
    try {
      globalThis.fetch = (async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          usage: { rolling: { percent: 12 }, weekly: { percent: 34 }, monthly: { percent: 56 } },
        }),
      })) as typeof fetch
      const ok = await requestUsage(readConfig(config()), { source: 'test', value: 'k' })
      expect(ok.status).toBe('ok')
      expect(ok.windows.map((window) => window.percent)).toEqual([12, 34, 56])

      globalThis.fetch = (async () => ({ ok: false, status: 401, json: async () => ({}) })) as typeof fetch
      expect((await requestUsage(readConfig(config()), { source: 'test', value: 'k' })).error).toBe('http-401')

      globalThis.fetch = (async () => {
        const error = new Error('timed out')
        error.name = 'TimeoutError'
        throw error
      }) as typeof fetch
      expect((await requestUsage(readConfig(config()), { source: 'test', value: 'k' })).error).toBe('timeout')

      globalThis.fetch = (async () => {
        throw new Error('offline')
      }) as typeof fetch
      expect((await requestUsage(readConfig(config()), { source: 'test', value: 'k' })).error).toBe('network')
    } finally {
      globalThis.fetch = original
    }
  })
})
