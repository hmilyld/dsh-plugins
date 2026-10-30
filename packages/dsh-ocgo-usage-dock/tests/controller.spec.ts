import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsFormScope, SettingsFormScopeSnapshot } from '@deepseek-ai/dsh-client-ui-primitives'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  SettingsForm: () => null,
  SettingsSecretField: () => null,
  SettingsValueField: () => null,
  Switch: () => null,
  settingsTextField: (field: string) => ({ field, format: () => '', parse: () => undefined }),
  settingsNumberField: (field: string) => ({ field, format: () => '', parse: () => undefined }),
  SettingsFormModel: class {
    constructor(private readonly scope: SettingsFormScope<any>) {}
    bind(project: () => unknown) {
      return { getSnapshot: project, subscribe: () => () => {} }
    }
    shell() {
      return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }
    }
    field(name: string) {
      const text = this.scope.getSnapshot().value?.[name]
      return { text: text === undefined ? '' : String(text), overridden: false, invalid: false }
    }
    actions() {
      return { edit: () => {}, resetField: () => {}, save: () => {}, discard: () => {} }
    }
    dispose() {}
  },
}))

const VERSION = '0.3.0'
const value = {
  apiKeyEnv: 'OPENCODE_GO_API_KEY',
  refreshIntervalMs: 300_000,
  timeoutMs: 15_000,
  baseUrl: 'https://example.test/usage',
  showBars: true,
}

/** A settings scope that records mutations and publishes nothing. */
function fakeScope(result: boolean, overrides: Partial<typeof value> = {}) {
  const calls: unknown[] = []
  const current = { ...value, ...overrides }
  const snapshot: SettingsFormScopeSnapshot<typeof value> = {
    status: 'ready',
    value: current,
    base: current,
    user: {},
    writable: true,
    revision: 4,
  }
  const scope: SettingsFormScope<typeof value> = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    mutate: async (ops, revision) => {
      calls.push({ ops, revision })
      return result
    },
  }
  return { scope, calls }
}

/** A context with just the services the controller touches. */
function fakeContext(scope: SettingsFormScope<typeof value>) {
  return {
    configForms: { get: () => scope },
    remote: {
      credentials: {
        describe: async () => ({ ok: true, value: { OPENCODE_GO_API_KEY: { configured: true, writable: true } } }),
      },
      ocgoUsage: {
        snapshot: async () => ({
          ok: true,
          value: {
            status: 'no-key',
            updatedAt: new Date().toISOString(),
            legacyApiKey: true,
            windows: [],
          },
        }),
      },
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('legacy key migration', () => {
  it('clears apiKey through an unset mutation even though it is absent from the user layer', async () => {
    vi.stubGlobal('__PKG_VERSION__', VERSION)
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
    const { scope, calls } = fakeScope(true)
    const { OcgoClientController } = await import('../src/client/controller.ts')
    const controller = new OcgoClientController(fakeContext(scope) as never)
    try {
      const face = controller.settingsFace()
      face.clearLegacyKey()
      await Promise.resolve()
      await Promise.resolve()
      expect(calls).toEqual([{ ops: [{ op: 'unset', path: ['apiKey'] }], revision: 4 }])
      expect(face.hooks.settings.getSnapshot().legacyClearFailed).toBe(false)
      expect(face.hooks.settings.getSnapshot().legacyClearBusy).toBe(false)
    } finally {
      controller.dispose()
    }
  })

  it('reports a failed clear without throwing', async () => {
    vi.stubGlobal('__PKG_VERSION__', VERSION)
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
    const { scope } = fakeScope(false)
    const { OcgoClientController } = await import('../src/client/controller.ts')
    const controller = new OcgoClientController(fakeContext(scope) as never)
    try {
      const face = controller.settingsFace()
      face.clearLegacyKey()
      await Promise.resolve()
      await Promise.resolve()
      expect(face.hooks.settings.getSnapshot().legacyClearFailed).toBe(true)
    } finally {
      controller.dispose()
    }
  })
})

describe('show bars setting', () => {
  it('defaults to showing the bars and mirrors the saved value', async () => {
    vi.stubGlobal('__PKG_VERSION__', VERSION)
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
    const { scope } = fakeScope(true)
    const { OcgoClientController } = await import('../src/client/controller.ts')
    const controller = new OcgoClientController(fakeContext(scope) as never)
    try {
      expect(controller.dockFace().hooks.usageDock.getSnapshot().showBars).toBe(true)
      expect(controller.settingsFace().hooks.settings.getSnapshot().showBars.text).toBe('true')
    } finally {
      controller.dispose()
    }
  })

  it('hides the bars when the saved value is false', async () => {
    vi.stubGlobal('__PKG_VERSION__', VERSION)
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
    const { scope } = fakeScope(true, { showBars: false })
    const { OcgoClientController } = await import('../src/client/controller.ts')
    const controller = new OcgoClientController(fakeContext(scope) as never)
    try {
      expect(controller.dockFace().hooks.usageDock.getSnapshot().showBars).toBe(false)
      expect(controller.settingsFace().hooks.settings.getSnapshot().showBars.text).toBe('false')
    } finally {
      controller.dispose()
    }
  })
})
