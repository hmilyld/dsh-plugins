/**
 * @hmilyld/dsh-ocgo-usage-dock — smoke tests.
 *
 * These run against the built artifacts with plain Node, no DSH boot:
 *   - manifest / bundle row / Typert export consistency,
 *   - pure configuration, credential, normalization, and request behaviour,
 *   - the live Service's Remote marker and cache / single-flight policy,
 *   - the generated Host reflection and client contribution,
 *   - the browser bundle's module-loader wrapper.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import {
  emptySnapshot,
  keyFingerprint,
  normalizeUsageShape,
  readConfig,
  requestUsage,
  resolveApiKey,
} from '../lib/types/usage.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

let passed = 0
/** Run one named assertion group. */
async function test(name, body) {
  try {
    await body()
    passed += 1
    console.log(`ok ${passed} - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

/** Minimal config object accepted by readConfig / the Service. */
function config(overrides = {}) {
  return {
    apiKey: '',
    apiKeyEnv: 'OPENCODE_GO_API_KEY',
    refreshIntervalMs: 60_000,
    timeoutMs: 1_000,
    baseUrl: 'https://example.test/usage',
    ...overrides,
  }
}

/** Run `body` with the three credential-related environment variables cleared. */
async function withCleanEnv(body) {
  const keys = ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY', 'OCGO_TEST_KEY']
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  try {
    return await body()
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

await test('manifest keeps the entry id and publishes every Typert face', () => {
  assert.equal(pkg.name, '@hmilyld/dsh-ocgo-usage-dock')
  assert.deepEqual(pkg.exports['.'], {
    types: './lib/types/index.d.ts',
    default: './lib/types/index.js',
  })
  assert.deepEqual(pkg.exports['./remote'], {
    types: './lib/typert.remote-client.d.ts',
    default: './lib/typert.remote-client.js',
  })
  assert.deepEqual(pkg.exports['./typert'], {
    types: './lib/typert.host.d.ts',
    default: './lib/typert.host.js',
  })
  for (const file of [
    'lib/typert.host.js',
    'lib/typert.host.d.ts',
    'lib/typert.remote-client.js',
    'lib/typert.remote-client.d.ts',
  ]) {
    assert.ok(pkg.files.includes(file), `${file} missing from files[]`)
    assert.ok(existsSync(join(root, file)), `${file} was not built`)
  }
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.engines.dsh.startsWith('>=0.2.0-rc.2'))
})

await test('bundle row id, package name, and default config agree', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /id:\s*ocgo-usage-dock/)
  assert.match(patch, new RegExp(`name:\\s*'${pkg.name.replace('/', '\\/')}'`))
  for (const key of ['apiKey', 'apiKeyEnv', 'refreshIntervalMs', 'timeoutMs', 'baseUrl']) {
    assert.match(patch, new RegExp(`${key}:`))
  }
})

await test('readConfig applies defaults and clamps unsafe values', () => {
  const resolved = readConfig({
    apiKey: '  ',
    apiKeyEnv: '  ',
    refreshIntervalMs: 1,
    timeoutMs: 0,
    baseUrl: '  ',
  })
  assert.equal(resolved.apiKey, '')
  assert.equal(resolved.apiKeyEnv, 'OPENCODE_GO_API_KEY')
  assert.equal(resolved.refreshIntervalMs, 300_000)
  assert.equal(resolved.timeoutMs, 15_000)
  assert.equal(resolved.baseUrl, 'https://opencode.ai/zen/go/v1/usage')
  assert.deepEqual(readConfig(config()).refreshIntervalMs, 60_000)
})

await test('normalization folds both documented response shapes', () => {
  const nested = normalizeUsageShape({
    usage: {
      rolling: { status: 'ok', percent: 42, resetsAt: '2026-10-19T12:00:00Z' },
      weekly: { status: 'warning', usagePercent: 70 },
      monthly: { status: 'critical', percent: 95, resetInSec: 3600 },
    },
  })
  assert.deepEqual(
    nested.map((window) => [window.id, window.percent, window.status]),
    [
      ['rolling', 42, 'ok'],
      ['weekly', 70, 'warning'],
      ['monthly', 95, 'critical'],
    ],
  )
  assert.equal(nested[0].resetsAt, '2026-10-19T12:00:00Z')
  assert.equal(nested[2].resetInSec, 3600)

  const flat = normalizeUsageShape({
    rollingUsage: { percent: 1.5 },
    weeklyUsage: { usagePercent: 101 },
    monthlyUsage: { percent: -3 },
  })
  assert.deepEqual(
    flat.map((window) => window.percent),
    [1.5, 100, 0],
  )

  const missing = normalizeUsageShape({})
  assert.equal(missing.length, 3)
  assert.ok(missing.every((window) => window.percent === null && window.status === 'unknown'))
})

await test('key precedence is config, apiKeyEnv, legacy env, then credentials', async () => {
  await withCleanEnv(async () => {
    const credentials = { resolve: async () => ({ value: 'from-store' }) }
    assert.deepEqual(
      await resolveApiKey(config({ apiKey: 'literal', apiKeyEnv: 'OCGO_TEST_KEY' }), credentials),
      { source: 'config', value: 'literal' },
    )
    process.env.OCGO_TEST_KEY = 'from-env'
    assert.deepEqual(
      await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), credentials),
      { source: 'OCGO_TEST_KEY', value: 'from-env' },
    )
    delete process.env.OCGO_TEST_KEY
    process.env.OPENCODE_API_KEY = 'legacy-env'
    assert.deepEqual(
      await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), credentials),
      { source: 'OPENCODE_API_KEY', value: 'legacy-env' },
    )
    delete process.env.OPENCODE_API_KEY
    assert.deepEqual(
      await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), credentials),
      { source: 'credentials', value: 'from-store' },
    )
    assert.equal(await resolveApiKey(config({ apiKeyEnv: 'OCGO_TEST_KEY' }), undefined), undefined)
  })
})

await test('key fingerprints change with the secret but never carry it', () => {
  const first = keyFingerprint({ source: 'credentials', value: 'secret-a' })
  const same = keyFingerprint({ source: 'credentials', value: 'secret-a' })
  const rotated = keyFingerprint({ source: 'credentials', value: 'secret-b' })
  assert.deepEqual(first, same)
  assert.notDeepEqual(first, rotated)
  assert.ok(!JSON.stringify(first).includes('secret-a'))
})

await test('requestUsage folds success, HTTP failure, and timeout', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ usage: { rolling: { percent: 12 }, weekly: { percent: 34 }, monthly: { percent: 56 } } }),
    })
    const ok = await requestUsage(config(), { source: 'test', value: 'k' })
    assert.equal(ok.status, 'ok')
    assert.deepEqual(ok.windows.map((window) => window.percent), [12, 34, 56])

    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) })
    assert.equal((await requestUsage(config(), { source: 'test', value: 'k' })).error, 'http-401')

    globalThis.fetch = async () => {
      const error = new Error('timed out')
      error.name = 'TimeoutError'
      throw error
    }
    assert.equal((await requestUsage(config(), { source: 'test', value: 'k' })).error, 'timeout')

    globalThis.fetch = async () => {
      throw new Error('offline')
    }
    assert.equal((await requestUsage(config(), { source: 'test', value: 'k' })).error, 'network')
  } finally {
    globalThis.fetch = original
  }
})

await test('Service exposes the generated Remote marker and caches by interval', async () => {
  await withCleanEnv(async () => {
    process.env.OPENCODE_GO_API_KEY = 'test-key'
    const { default: OcgoUsageController } = await import('../lib/types/index.js')
    const ctx = new Context()
    const service = new OcgoUsageController(
      ctx,
      config({ refreshIntervalMs: 60_000, baseUrl: 'https://example.test/usage' }),
    )
    assert.equal(service.name, 'ocgoUsage')
    assert.deepEqual(remoteMethods(service), [
      { method: 'snapshot', invocation: { kind: 'direct' } },
    ])

    const original = globalThis.fetch
    let calls = 0
    try {
      globalThis.fetch = async () => {
        calls += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({ usage: { rolling: { percent: 10 } } }),
        }
      }
      const first = await service.snapshot(false)
      assert.equal(first.status, 'ok')
      assert.equal(first.legacyApiKey, false)
      assert.equal(calls, 1)

      await service.snapshot(false)
      assert.equal(calls, 1, 'second read must hit the cache')

      await service.snapshot(true)
      assert.equal(calls, 2, 'force must bypass the cache')

      const [sharedA, sharedB] = await Promise.all([service.snapshot(true), service.snapshot(true)])
      assert.equal(calls, 3, 'concurrent forced reads share one request')
      assert.deepEqual(sharedA, sharedB)

      process.env.OPENCODE_GO_API_KEY = 'rotated-key'
      await service.snapshot(false)
      assert.equal(calls, 4, 'a rotated key must invalidate the cache')
    } finally {
      globalThis.fetch = original
    }
  })
})

await test('no key produces a quiet no-key snapshot; the legacy flag reports config', async () => {
  await withCleanEnv(async () => {
    const { default: OcgoUsageController } = await import('../lib/types/index.js')
    const noKey = new OcgoUsageController(new Context(), config())
    const snapshot = await noKey.snapshot(false)
    assert.equal(snapshot.status, 'no-key')
    assert.equal(snapshot.legacyApiKey, false)
    assert.deepEqual(snapshot.windows, [])

    const legacy = new OcgoUsageController(new Context(), config({ apiKey: 'legacy' }))
    const original = globalThis.fetch
    try {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ usage: { rolling: { percent: 1 } } }),
      })
      const withLegacy = await legacy.snapshot(false)
      assert.equal(withLegacy.status, 'ok')
      assert.equal(withLegacy.legacyApiKey, true)
    } finally {
      globalThis.fetch = original
    }
  })
})

await test('emptySnapshot preserves an optional error without undefined fields', () => {
  const plain = emptySnapshot(readConfig(config()), 'no-key')
  assert.equal('error' in plain, false)
  const failed = emptySnapshot(readConfig(config()), 'error', 'network')
  assert.equal(failed.error, 'network')
})

await test('generated reflection and client contribution name the endpoint', () => {
  const host = readFileSync(join(root, 'lib/typert.host.js'), 'utf8')
  assert.match(host, /ocgoUsage/)
  assert.match(host, /snapshot/)
  const remote = readFileSync(join(root, 'lib/typert.remote-client.js'), 'utf8')
  assert.match(remote, /ocgoUsage\/snapshot/)
  const remoteTypes = readFileSync(join(root, 'lib/typert.remote-client.d.ts'), 'utf8')
  assert.match(remoteTypes, /snapshot: \(force: boolean\)/)
})

await test('client bundle uses the DSH module-loader wrapper and bundles the Remote', () => {
  const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
  assert.match(client, /window\.__ModuleLoader__\.load\(/)
  assert.ok(client.includes(`id: ${JSON.stringify(pkg.name)}`))
  assert.match(client, /ocgoUsage\/snapshot/)
  assert.match(client, /conversation\.input\.dock/)
  assert.match(client, /plugins\.bundle\.config/)
  assert.match(client, /registry\.npmjs\.org/)
  assert.ok(client.includes('blob/main/packages/dsh-ocgo-usage-dock/CHANGELOG.md'))
})

await test('client bundle evaluates against the loader module table', () => {
  let loaded
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load: (entry) => {
        loaded = entry
      },
    },
  }
  try {
    const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
    // The bundle is not an ES module: evaluate it with the loader wrapper in scope.
    new Function('window', client)(globalThis.window)
    assert.ok(loaded !== undefined, 'bundle did not call __ModuleLoader__.load')
    assert.equal(loaded.id, pkg.name)
    const stubs = {
      'react/jsx-runtime': {
        jsx: () => null,
        jsxs: () => null,
        Fragment: 'fragment',
      },
      '@deepseek-ai/dsh-client-ui-primitives': {
        SettingsForm: () => null,
        SettingsFormModel: class {},
        SettingsValueField: () => null,
        SettingsSecretField: () => null,
        settingsTextField: () => ({ field: '', format: () => '', parse: () => undefined }),
      },
    }
    const module = loaded.factory((name) => {
      const stub = stubs[name]
      assert.ok(stub !== undefined, `unexpected runtime module ${name}`)
      return stub
    })
    assert.equal(typeof module.apply, 'function')
    assert.ok(Array.isArray(module.inject))
    assert.ok(module.inject.includes('remote'))
    assert.match(client, /remote\.ocgoUsage/)
    assert.match(client, /remote\.credentials/)
  } finally {
    globalThis.window = previousWindow
  }
})

console.log(`\n${passed} smoke test groups passed`)
