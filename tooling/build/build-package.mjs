#!/usr/bin/env node
/**
 * Build one plugin package in the standard two-pass order.
 *
 * Usage: node tooling/build/build-package.mjs <packageDir>
 *
 *   tsc -b tsconfig.json            -> lib/types
 *   tsdown (DSH_BUILD_FACE=host)    -> lib/index.js + lib/typert.*
 *   tsc -b tsconfig.client.json     -> lib/types/client
 *   tsdown (DSH_BUILD_FACE=client)  -> lib/client.js
 *
 * A package without `./client` stops after the host pass. Source packages that
 * are not plugins (the private kit) build with plain `tsc` and do not use this
 * script.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const packageDir = resolve(process.argv[2] ?? process.cwd())
const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc')
const tsdown = join(dirname(require.resolve('tsdown/package.json')), 'dist', 'run.mjs')

const hasClient =
  typeof pkg.exports === 'object' && pkg.exports !== null && './client' in pkg.exports
const hasTypert =
  typeof pkg.exports === 'object' &&
  pkg.exports !== null &&
  ('./typert' in pkg.exports || './remote' in pkg.exports)

/** Run one tool in the package directory. */
function run(command, args, face) {
  execFileSync(command, args, {
    cwd: packageDir,
    stdio: 'inherit',
    env: face === undefined ? process.env : { ...process.env, DSH_BUILD_FACE: face },
  })
}

console.log(`[build] ${pkg.name}`)
rmSync(join(packageDir, 'lib'), { recursive: true, force: true })

run(process.execPath, [tsc, '-b', '--force', 'tsconfig.json'])
run(process.execPath, [tsdown], 'host')

if (hasTypert && !existsSync(join(packageDir, 'lib', 'typert.host.js'))) {
  throw new Error(`${pkg.name}: build produced no lib/typert.host.js`)
}
if (hasTypert && !existsSync(join(packageDir, 'lib', 'typert.remote-client.js'))) {
  throw new Error(`${pkg.name}: build produced no lib/typert.remote-client.js`)
}
if (!existsSync(join(packageDir, 'lib', 'index.js'))) {
  throw new Error(`${pkg.name}: build produced no lib/index.js`)
}

if (hasClient) {
  run(process.execPath, [tsc, '-b', '--force', 'tsconfig.client.json'])
  run(process.execPath, [tsdown], 'client')
  if (!existsSync(join(packageDir, 'lib', 'client.js'))) {
    throw new Error(`${pkg.name}: build produced no lib/client.js`)
  }
}

console.log(`[build] ${pkg.name} done`)
