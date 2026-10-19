#!/usr/bin/env node
/**
 * Bundle one plugin's browser half into the artifact the DSH client module
 * loader loads at runtime.
 *
 * Usage: node tooling/build/build-client.mjs <packageDir>
 *
 * The wrapper shape (`window.__ModuleLoader__.load({ id, factory })`) and the
 * external list are the contract every official `@deepseek-ai/dsh-client-*`
 * bundle follows: platform seeds such as `react` and the shared
 * `@deepseek-ai/*` packages stay as `require(...)` calls resolved by the
 * loader's module table, so no second copy of React or of an official UI
 * component ever enters the bundle. Everything else — notably the generated
 * Typert Remote contribution and its `zod` schemas — is bundled.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

const packageDir = resolve(process.argv[2] ?? process.cwd())
const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
  throw new Error(`build-client: ${packageDir}/package.json has no name`)
}

const entry = join(packageDir, 'src', 'client', 'index.ts')
const entryTsx = join(packageDir, 'src', 'client', 'index.tsx')
const entryPoint = exists(entryTsx) ? entryTsx : entry

const banner = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`

const footer = `\t\tObject.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
\t\treturn module.exports;
\t}
});
`

/** Generated Remote contribution lives at the package root; alias it in. */
const alias = {
  [`${pkg.name}/remote`]: join(packageDir, 'lib', 'typert.remote-client.js'),
  [`${pkg.name}/types`]: join(packageDir, 'lib', 'types', 'types.js'),
}

await build({
  entryPoints: [entryPoint],
  outfile: join(packageDir, 'lib', 'client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  alias,
  external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@deepseek-ai/*'],
  banner: { js: banner },
  footer: { js: footer },
  logLevel: 'info',
})

function exists(file) {
  try {
    readFileSync(file)
    return true
  } catch {
    return false
  }
}
