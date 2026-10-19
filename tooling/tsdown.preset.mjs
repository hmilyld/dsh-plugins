/**
 * Shared tsdown preset for a plugin package.
 *
 * Two build faces:
 *   - `host`:   lib/types/index.js  -> lib/index.js (ESM) + Typert reflection
 *   - `client`: lib/types/client/index.js -> lib/client.js (CJS ModuleLoader factory)
 *
 * The package's `tsdown.config.ts` is one line:
 *   export default pluginConfig(import.meta.dirname, process.env.DSH_BUILD_FACE)
 *
 * `tooling/build/build-package.mjs` drives the faces in order; tsdown itself
 * does not need to know which face runs first.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { typertPlugin } from '@deepseek-ai/dsh-typert-generator/tsdown'

const REACT_BASELINE = ['react', 'react-dom', 'react/jsx-runtime']

/** Read one package manifest. */
function manifestOf(packageDir) {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
}

/** Whether the manifest exports a browser half. */
function hasClient(pkg) {
  return typeof pkg.exports === 'object' && pkg.exports !== null && './client' in pkg.exports
}

/** Whether the manifest publishes Typert reflection. */
function hasTypert(pkg) {
  return (
    typeof pkg.exports === 'object' &&
    pkg.exports !== null &&
    ('./typert' in pkg.exports || './remote' in pkg.exports)
  )
}

/** Production sections a Host bundle must leave as imports. */
function hostExternals(pkg) {
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ])
  const list = [...names]
  return (id) => list.some((name) => id === name || id.startsWith(`${name}/`))
}

/** Module-table specifiers a Client bundle must leave as `require(...)`. */
function clientExternals(pkg) {
  const requested = new Set([
    ...(pkg.dsh?.client?.inject ?? []),
    ...(pkg.dsh?.client?.external ?? []),
    ...REACT_BASELINE,
  ])
  return (id) =>
    requested.has(id) ||
    id.startsWith('react/') ||
    id.startsWith('react-dom/')
}

/** Changelog URL derived from the repository manifest, when it is a GitHub repo. */
function changelogUrl(pkg) {
  const raw = pkg.repository?.url
  const directory = pkg.repository?.directory
  if (typeof raw !== 'string' || typeof directory !== 'string') return ''
  const repo = raw.replace(/^git\+/, '').replace(/\.git$/, '')
  if (!repo.startsWith('https://github.com/')) return ''
  return `${repo}/blob/main/${directory}/CHANGELOG.md`
}

/** Build the config for one face. */
export function pluginConfig(packageDir, face = 'host') {
  const pkg = manifestOf(packageDir)
  const define = {
    __PKG_VERSION__: JSON.stringify(pkg.version),
    __PKG_CHANGELOG_URL__: JSON.stringify(changelogUrl(pkg)),
  }
  if (face === 'client') {
    if (!hasClient(pkg)) throw new Error(`${pkg.name}: no ./client export`)
    const external = clientExternals(pkg)
    return {
      name: `${pkg.name}/client`,
      entry: { client: 'lib/types/client/index.js' },
      outDir: 'lib',
      format: ['cjs'],
      fixedExtension: false,
      platform: 'browser',
      target: 'es2022',
      dts: false,
      clean: false,
      sourcemap: true,
      deps: {
        neverBundle: external,
        alwaysBundle: (id) => !external(id),
      },
      define,
      outputOptions: {
        entryFileNames: 'client.js',
        banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
        footer: 'return module.exports; } });',
        intro: 'var module = { exports: {} }; var exports = module.exports;',
      },
    }
  }
  if (face !== 'host') throw new Error(`pluginConfig: unknown face ${String(face)}`)
  const plugins = hasTypert(pkg) ? [typertPlugin({ mode: 'package', faces: ['host'] })] : []
  return {
    name: `${pkg.name}/host`,
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    fixedExtension: false,
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: hostExternals(pkg),
    },
    define,
    plugins,
  }
}
