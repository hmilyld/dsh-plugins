import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import OcgoUsageController from '../lib/index.js'
import type { Config } from '../src/config.ts'

const KEY = 'OPENCODE_GO_API_KEY'

function config(overrides: Partial<Record<keyof Config, unknown>> = {}): Config {
  return {
    apiKey: '',
    apiKeyEnv: KEY,
    refreshIntervalMs: 60_000,
    timeoutMs: 1_000,
    baseUrl: 'https://example.test/usage',
    ...overrides,
  } as Config
}

let savedKey: string | undefined

beforeEach(() => {
  savedKey = process.env[KEY]
  process.env[KEY] = 'test-key'
})

afterEach(() => {
  if (savedKey === undefined) delete process.env[KEY]
  else process.env[KEY] = savedKey
})

describe('Remote service', () => {
  it('exposes the generated Remote marker', () => {
    const service = new OcgoUsageController(new Context(), config())
    expect(service.name).toBe('ocgoUsage')
    expect(remoteMethods(service)).toEqual([{ method: 'snapshot', invocation: { kind: 'direct' } }])
  })

  it('caches by interval, forces through, and rotates on a new key', async () => {
    const service = new OcgoUsageController(new Context(), config())
    const original = globalThis.fetch
    let calls = 0
    try {
      globalThis.fetch = (async () => {
        calls += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({ usage: { rolling: { percent: 10 } } }),
        }
      }) as typeof fetch
      expect((await service.snapshot(false)).status).toBe('ok')
      expect(calls).toBe(1)
      await service.snapshot(false)
      expect(calls).toBe(1)
      await service.snapshot(true)
      expect(calls).toBe(2)
      const [a, b] = await Promise.all([service.snapshot(true), service.snapshot(true)])
      expect(a).toEqual(b)
      expect(calls).toBe(3)
      process.env[KEY] = 'rotated-key'
      await service.snapshot(false)
      expect(calls).toBe(4)
    } finally {
      globalThis.fetch = original
    }
  })

  it('runs a fresh request after a forced call joins an in-flight poll', async () => {
    const service = new OcgoUsageController(new Context(), config())
    const original = globalThis.fetch
    let calls = 0
    let releaseFirst: (() => void) | undefined
    try {
      globalThis.fetch = (async () => {
        calls += 1
        if (calls === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ usage: { rolling: { percent: calls } } }),
        }
      }) as typeof fetch

      const first = service.snapshot(false)
      await new Promise((resolve) => setImmediate(resolve))
      const forced = service.snapshot(true)
      await new Promise((resolve) => setImmediate(resolve))
      releaseFirst?.()
      const [firstResult, forcedResult] = await Promise.all([first, forced])
      expect(firstResult.status).toBe('ok')
      expect(forcedResult.status).toBe('ok')
      expect(calls).toBe(2)
    } finally {
      globalThis.fetch = original
    }
  })

  it('returns a quiet no-key snapshot and reports the legacy flag', async () => {
    const noKey = new OcgoUsageController(new Context(), config())
    delete process.env[KEY]
    const snapshot = await noKey.snapshot(false)
    expect(snapshot.status).toBe('no-key')
    expect(snapshot.legacyApiKey).toBe(false)

    const legacy = new OcgoUsageController(new Context(), config({ apiKey: 'legacy' }))
    const original = globalThis.fetch
    try {
      globalThis.fetch = (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ usage: { rolling: { percent: 1 } } }),
      })) as typeof fetch
      const result = await legacy.snapshot(false)
      expect(result.status).toBe('ok')
      expect(result.legacyApiKey).toBe(true)
    } finally {
      globalThis.fetch = original
    }
  })
})
