import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string }

describe('client bundle', () => {
  it('registers with the DSH module loader and only requests module-table rows', () => {
    let registration: { id: string; factory: (require: (name: string) => unknown) => Record<string, unknown> } | undefined
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
        'react/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: 'fragment' },
        '@deepseek-ai/dsh-client-ui-primitives': {
          SettingsForm: () => null,
          SettingsFormModel: class {},
          SettingsValueField: () => null,
          SettingsSecretField: () => null,
          settingsTextField: () => ({ field: '', format: () => '', parse: () => undefined }),
        },
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

  it('contains the update check and the generated Remote endpoint', () => {
    const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
    expect(source).toContain('ocgoUsage/snapshot')
    expect(source).toContain('registry.npmjs.org')
    expect(source).toContain('blob/main/packages/dsh-ocgo-usage-dock/CHANGELOG.md')
  })
})
