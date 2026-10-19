import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compareVersions, isNewerVersion, parseVersion } from '../src/updates/version.ts'
import { createUpdateStore } from '../src/updates/store.ts'
import { UpdateNotice } from '../src/updates/UpdateNotice.tsx'

/** Minimal in-memory Storage. */
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
  }
}

/** A fetch stub returning successive `latest` payloads and counting calls. */
function registryStub(versions: Array<string | Error>) {
  const calls: string[] = []
  let index = 0
  const fetchImpl = (async (url: string | URL | Request) => {
    calls.push(String(url))
    const version = versions[Math.min(index, versions.length - 1)]
    index += 1
    if (version instanceof Error) throw version
    return {
      ok: true,
      status: 200,
      json: async () => ({ version }),
    } as Response
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('version comparison', () => {
  it('parses versions with and without prereleases', () => {
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    expect(parseVersion('0.3.0-rc.2+build.5')).toEqual({
      major: 0,
      minor: 3,
      patch: 0,
      prerelease: ['rc', 2],
    })
    expect(parseVersion('nope')).toBeUndefined()
  })

  it('compares releases, prereleases, and multi-digit parts', () => {
    expect(compareVersions('0.2.1', '0.2.1')).toBe(0)
    expect(compareVersions('0.3.0', '0.2.1')).toBeGreaterThan(0)
    expect(compareVersions('0.2.10', '0.2.9')).toBeGreaterThan(0)
    expect(compareVersions('0.3.0-rc.1', '0.3.0')).toBeLessThan(0)
    expect(compareVersions('0.3.0-rc.2', '0.3.0-rc.1')).toBeGreaterThan(0)
    expect(isNewerVersion('0.3.0', '0.2.1')).toBe(true)
    expect(isNewerVersion('0.2.1', '0.2.1')).toBe(false)
  })
})

describe('update store', () => {
  it('reports an update and encodes scoped package names', async () => {
    const { fetchImpl, calls } = registryStub(['0.3.0'])
    const updates = createUpdateStore({
      packageName: '@hmilyld/dsh-beacon',
      currentVersion: '0.2.2',
      fetchImpl,
      storage: memoryStorage(),
    })
    expect(updates.getSnapshot().updateAvailable).toBe(false)
    await updates.refresh(false)
    const state = updates.getSnapshot()
    expect(state.latestVersion).toBe('0.3.0')
    expect(state.updateAvailable).toBe(true)
    expect(state.error).toBeNull()
    expect(state.checkedAt).not.toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatch(/@hmilyld%2Fdsh-beacon\/latest$/)
  })

  it('serves a fresh cache without a second request, and force bypasses it', async () => {
    const { fetchImpl, calls } = registryStub(['0.3.0', '0.3.1'])
    const updates = createUpdateStore({
      packageName: '@hmilyld/dsh-beacon',
      currentVersion: '0.2.2',
      fetchImpl,
      storage: memoryStorage(),
    })
    await updates.refresh(false)
    await updates.refresh(false)
    expect(calls).toHaveLength(1)
    await updates.refresh(true)
    expect(calls).toHaveLength(2)
    expect(updates.getSnapshot().latestVersion).toBe('0.3.1')
  })

  it('publishes to subscribers and survives a registry failure', async () => {
    const { fetchImpl } = registryStub([new Error('offline')])
    const updates = createUpdateStore({
      packageName: '@hmilyld/dsh-beacon',
      currentVersion: '0.2.2',
      fetchImpl,
      storage: null,
    })
    const seen: Array<string | null> = []
    const off = updates.subscribe(() => seen.push(updates.getSnapshot().error))
    await updates.refresh(false)
    off()
    expect(updates.getSnapshot().error).toBe('offline')
    expect(updates.getSnapshot().latestVersion).toBeNull()
    expect(seen).toEqual(['offline'])
  })

  it('treats an unpublished package as up to date and caches the answer', async () => {
    let calls = 0
    const storage = memoryStorage()
    const updates = createUpdateStore({
      packageName: '@hmilyld/dsh-not-published',
      currentVersion: '0.1.0',
      storage,
      fetchImpl: (async () => {
        calls += 1
        return { ok: false, status: 404, json: async () => ({}) } as Response
      }) as typeof fetch,
    })
    await updates.refresh(false)
    const state = updates.getSnapshot()
    expect(state.latestVersion).toBeNull()
    expect(state.updateAvailable).toBe(false)
    expect(state.error).toBeNull()
    expect(calls).toBe(1)
    await updates.refresh(false)
    expect(calls).toBe(1)
  })

  it('seeds the store from a cached answer before any request', () => {
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
    expect(updates.getSnapshot().latestVersion).toBe('0.4.0')
    expect(updates.getSnapshot().updateAvailable).toBe(true)
  })
})

describe('update notice', () => {
  it('renders only when an update is available', () => {
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
    expect(html).toContain('New v0.3.0 (running v0.2.2)')
    expect(html).toContain('https://example.test/CHANGELOG.md')
    expect(html).toContain('View release notes')

    const current = renderToStaticMarkup(
      createElement(UpdateNotice, {
        state: { ...status, latestVersion: '0.2.2', updateAvailable: false },
        changelogUrl: 'https://example.test/CHANGELOG.md',
        labels: { available: 'New v{latest}', changelog: 'View release notes' },
      }),
    )
    expect(current).toBe('')
  })
})
