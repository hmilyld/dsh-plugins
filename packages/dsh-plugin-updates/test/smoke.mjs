/**
 * @hmilyld/dsh-plugin-updates — smoke tests.
 *
 * The library is browser-oriented, so the test injects fetch, storage, and a
 * clock instead of touching the network or a real localStorage.
 */
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compareVersions, isNewerVersion, parseVersion, UpdateNotice } from '../lib/index.js'
import { createUpdateStore } from '../lib/store.js'

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

/** Minimal in-memory Storage. */
function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value))
    },
  }
}

/** A fetch stub returning a `latest` payload and counting calls. */
function registryStub(versions) {
  const calls = []
  let index = 0
  const fetchImpl = async (url) => {
    calls.push(String(url))
    const version = versions[Math.min(index, versions.length - 1)]
    index += 1
    if (version instanceof Error) throw version
    return {
      ok: true,
      status: 200,
      json: async () => ({ version }),
    }
  }
  return { fetchImpl, calls }
}

await test('parses versions with and without prereleases', () => {
  assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: [] })
  assert.deepEqual(parseVersion('0.3.0-rc.2+build.5'), {
    major: 0,
    minor: 3,
    patch: 0,
    prerelease: ['rc', 2],
  })
  assert.equal(parseVersion('nope'), undefined)
})

await test('compares releases, prereleases, and multi-digit parts', () => {
  assert.equal(compareVersions('0.2.1', '0.2.1'), 0)
  assert.ok(compareVersions('0.3.0', '0.2.1') > 0)
  assert.ok(compareVersions('0.2.10', '0.2.9') > 0)
  assert.ok(compareVersions('0.3.0-rc.1', '0.3.0') < 0)
  assert.ok(compareVersions('0.3.0-rc.2', '0.3.0-rc.1') > 0)
  assert.equal(isNewerVersion('0.3.0', '0.2.1'), true)
  assert.equal(isNewerVersion('0.2.1', '0.2.1'), false)
})

await test('reports an update and encodes scoped package names', async () => {
  const { fetchImpl, calls } = registryStub(['0.3.0'])
  const updates = createUpdateStore({
    packageName: '@hmilyld/dsh-beacon',
    currentVersion: '0.2.2',
    fetchImpl,
    storage: memoryStorage(),
  })
  assert.equal(updates.getSnapshot().updateAvailable, false)
  await updates.refresh(false)
  const state = updates.getSnapshot()
  assert.equal(state.latestVersion, '0.3.0')
  assert.equal(state.updateAvailable, true)
  assert.equal(state.error, null)
  assert.ok(state.checkedAt !== null)
  assert.equal(calls.length, 1)
  assert.match(calls[0], /@hmilyld%2Fdsh-beacon\/latest$/)
})

await test('serves a fresh cache without a second request, and force bypasses it', async () => {
  const { fetchImpl, calls } = registryStub(['0.3.0', '0.3.1'])
  const updates = createUpdateStore({
    packageName: '@hmilyld/dsh-beacon',
    currentVersion: '0.2.2',
    fetchImpl,
    storage: memoryStorage(),
  })
  await updates.refresh(false)
  await updates.refresh(false)
  assert.equal(calls.length, 1)
  await updates.refresh(true)
  assert.equal(calls.length, 2)
  assert.equal(updates.getSnapshot().latestVersion, '0.3.1')
})

await test('publishes to subscribers and survives a registry failure', async () => {
  const { fetchImpl } = registryStub([new Error('offline')])
  const updates = createUpdateStore({
    packageName: '@hmilyld/dsh-beacon',
    currentVersion: '0.2.2',
    fetchImpl,
    storage: null,
  })
  const seen = []
  const off = updates.subscribe(() => seen.push(updates.getSnapshot().error))
  await updates.refresh(false)
  off()
  assert.equal(updates.getSnapshot().error, 'offline')
  assert.equal(updates.getSnapshot().latestVersion, null)
  assert.deepEqual(seen, ['offline'])
})

await test('treats an unpublished package as up to date and caches the answer', async () => {
  let calls = 0
  const storage = memoryStorage()
  const updates = createUpdateStore({
    packageName: '@hmilyld/dsh-not-published',
    currentVersion: '0.1.0',
    storage,
    fetchImpl: async () => {
      calls += 1
      return { ok: false, status: 404, json: async () => ({}) }
    },
  })
  await updates.refresh(false)
  const state = updates.getSnapshot()
  assert.equal(state.latestVersion, null)
  assert.equal(state.updateAvailable, false)
  assert.equal(state.error, null)
  assert.equal(calls, 1)
  await updates.refresh(false)
  assert.equal(calls, 1, 'the negative answer is cached')
})

await test('a cached answer seeds the store before any request', () => {
  const storage = memoryStorage()
  storage.setItem(
    'dsh-plugin-updates:v1:@hmilyld/dsh-ocgo-usage-dock',
    JSON.stringify({ latestVersion: '0.4.0', checkedAt: Date.now() }),
  )
  const updates = createUpdateStore({
    packageName: '@hmilyld/dsh-ocgo-usage-dock',
    currentVersion: '0.3.0',
    fetchImpl: async () => {
      throw new Error('should not fetch')
    },
    storage,
  })
  assert.equal(updates.getSnapshot().latestVersion, '0.4.0')
  assert.equal(updates.getSnapshot().updateAvailable, true)
})

await test('renders the notice only when an update is available', () => {
  const status = {
    packageName: '@hmilyld/dsh-beacon',
    currentVersion: '0.2.2',
    latestVersion: '0.3.0',
    updateAvailable: true,
    checkedAt: 1,
    error: null,
  }
  const html = renderToStaticMarkup(
    createElement(UpdateNotice, {
      state: status,
      changelogUrl: 'https://example.test/CHANGELOG.md',
      labels: { available: 'New v{latest} (running v{current})', changelog: 'View release notes' },
    }),
  )
  assert.match(html, /New v0\.3\.0 \(running v0\.2\.2\)/)
  assert.match(html, /https:\/\/example\.test\/CHANGELOG\.md/)
  assert.match(html, /View release notes/)

  const current = renderToStaticMarkup(
    createElement(UpdateNotice, {
      state: { ...status, latestVersion: '0.2.2', updateAvailable: false },
      changelogUrl: 'https://example.test/CHANGELOG.md',
      labels: { available: 'New v{latest}', changelog: 'View release notes' },
    }),
  )
  assert.equal(current, '')
})

console.log(`\n${passed} smoke test groups passed`)
