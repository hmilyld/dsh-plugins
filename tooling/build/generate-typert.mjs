#!/usr/bin/env node
/**
 * Generate Typert Host reflection and the Host-for-Client Remote contribution
 * for selected workspace packages.
 *
 * Usage: node tooling/build/generate-typert.mjs <workspaceRoot> <packageName...>
 *
 * The generator consumes the TypeScript program declared by the workspace
 * aggregate (`tsconfig.host.json`) and the per-package `tsconfig.json`. Run it
 * after `tsc -b tsconfig.host.json` has produced `lib/types`, so the
 * declaration the generator emits references files that already exist.
 *
 * Output (beside `lib/types`):
 *   lib/typert.host.js / .d.ts            – schema factories + reflection
 *   lib/typert.remote-client.js / .d.ts   – the client contribution
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { WorkspaceTypertGenerator } from '@deepseek-ai/dsh-typert-generator'

const root = resolve(process.argv[2] ?? process.cwd())
const packages = process.argv.slice(3)
if (packages.length === 0) {
  throw new Error('generate-typert: pass at least one package name')
}

const artifacts = new WorkspaceTypertGenerator(root, { checkDiagnostics: false }).generate(packages, ['host'])

for (const artifact of artifacts) {
  const out = join(root, artifact.packageRoot, 'lib')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, `typert.${artifact.face}.js`), artifact.js)
  writeFileSync(join(out, `typert.${artifact.face}.d.ts`), artifact.dts)
  if (artifact.remote !== undefined) {
    writeFileSync(join(out, 'typert.remote-client.js'), artifact.remote.js)
    writeFileSync(join(out, 'typert.remote-client.d.ts'), artifact.remote.dts)
    writeFileSync(join(out, 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap)
  } else {
    for (const file of ['typert.remote-client.js', 'typert.remote-client.d.ts', 'typert.remote-client.d.ts.map']) {
      rmSync(join(out, file), { force: true })
    }
  }
  console.log(`generate-typert: emitted ${artifact.package}`)
}

if (artifacts.length === 0) {
  console.warn(`generate-typert: no artifacts for ${packages.join(', ')}`)
}
