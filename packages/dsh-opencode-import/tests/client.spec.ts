import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string }

/** One module-table stub that tolerates any member access. */
function moduleStub(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    SettingsForm: () => null,
    SettingsFormModel: class {
      bind() {
        return { subscribe: () => () => {} }
      }
      shell() {
        return {}
      }
      field() {
        return { text: '', overridden: false, invalid: false }
      }
      actions() {
        return {}
      }
      dispose() {}
    },
    SettingsValueField: () => null,
    SettingsSecretField: () => null,
    Switch: () => null,
    Button: () => null,
    settingsTextField: () => ({ field: '', format: () => '', parse: () => undefined }),
    settingsNumberField: () => ({ field: '', format: () => '', parse: () => undefined }),
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useMemo: (factory: () => unknown) => factory(),
    useRef: () => ({ current: undefined }),
    useSyncExternalStore: () => undefined,
  }
  return new Proxy(base, {
    get: (target, key) => (key in target ? target[key as string] : () => null),
  })
}

describe('client bundle', () => {
  it('registers with the DSH module loader and only requests module-table rows', () => {
    let registration:
      | { id: string; factory: (require: (name: string) => unknown) => Record<string, unknown> }
      | undefined
    globalThis.window = {
      __ModuleLoader__: {
        load: (entry: typeof registration) => {
          registration = entry
        },
      },
    } as never
    try {
      const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
      new Function('window', source)(globalThis.window)
      expect(registration?.id).toBe(pkg.name)

      const stubs: Record<string, unknown> = {
        react: moduleStub(),
        'react/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: 'fragment' },
        '@deepseek-ai/dsh-client-ui-primitives': moduleStub(),
      }
      const module = registration!.factory((name) => {
        expect(stubs[name], `unexpected runtime module ${name}`).toBeDefined()
        return stubs[name]
      })
      expect(typeof module.apply).toBe('function')
      expect(module.inject).toEqual(['remote'])
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })

  it('contains the generated Remote endpoints, slots, and update check', () => {
    const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
    expect(source).toContain('opencodeImport/status')
    expect(source).toContain('opencodeImport/scan')
    expect(source).toContain('opencodeImport/preview')
    expect(source).toContain('sidebar.session.row.leading')
    expect(source).toContain('conversation.input.dock')
    expect(source).toContain('registry.npmjs.org')
    expect(source).toContain('blob/main/packages/dsh-opencode-import/CHANGELOG.md')
  })
})
