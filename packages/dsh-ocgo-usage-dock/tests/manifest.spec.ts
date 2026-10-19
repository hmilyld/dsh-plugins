import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, any>

describe('package manifest', () => {
  it('publishes the official artifact layout', () => {
    expect(pkg.name).toBe('@hmilyld/dsh-ocgo-usage-dock')
    expect(pkg.main).toBe('lib/index.js')
    expect(pkg.types).toBe('lib/types/index.d.ts')
    expect(pkg.exports['.']).toEqual({
      types: './lib/types/index.d.ts',
      default: './lib/index.js',
    })
    expect(pkg.exports['./client']).toEqual({
      types: './lib/types/client/index.d.ts',
      default: './lib/client.js',
    })
    expect(pkg.exports['./remote']).toEqual({
      types: './lib/typert.remote-client.d.ts',
      default: './lib/typert.remote-client.js',
    })
  })

  it('ships every runtime artifact and the changelog', () => {
    for (const file of [
      'lib/index.js',
      'lib/client.js',
      'lib/typert.host.js',
      'lib/typert.host.d.ts',
      'lib/typert.remote-client.js',
      'lib/typert.remote-client.d.ts',
    ]) {
      expect(pkg.files).toContain(file)
      expect(existsSync(join(root, file))).toBe(true)
    }
    expect(pkg.files).toContain('CHANGELOG.md')
    expect(pkg.files).toContain('cordis.patch.yml')
  })

  it('keeps the Loader id and package name aligned with the bundle row', () => {
    const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
    expect(patch).toMatch(/id:\s*ocgo-usage-dock/)
    expect(patch).toContain(`name: '${pkg.name}'`)
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh.client.platform).toBe('web')
    expect(pkg.engines.dsh).toBe('>=0.2.0-rc.2 <0.3.0')
  })

  it('has no committed build output or package-level workflow', () => {
    expect(existsSync(join(root, '.github'))).toBe(false)
    expect(existsSync(join(root, 'scripts'))).toBe(false)
  })
})
