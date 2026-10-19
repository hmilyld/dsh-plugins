#!/usr/bin/env node
/**
 * Generate a standard plugin package.
 *
 * Usage: pnpm gen:plugin dsh-foo
 *
 * The generated package has no Typert Remote yet: it is a simple Host plugin
 * with a settings card. Add `@Remote` methods by following the ocgo package and
 * the Typert section of docs/plugin-standard.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const requested = process.argv[2]
if (requested === undefined || requested.trim() === '') {
  console.error('usage: pnpm gen:plugin dsh-foo')
  process.exit(2)
}
const local = requested.trim().replace(/^@hmilyld\//, '')
if (!/^dsh-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(local)) {
  console.error('plugin name must look like dsh-foo (lowercase kebab-case)')
  process.exit(2)
}
const entry = local.slice('dsh-'.length)
const packageName = `@hmilyld/${local}`
const packageDir = join(root, 'packages', local)
if (existsSync(packageDir)) {
  console.error(`${packageDir} already exists`)
  process.exit(2)
}

const title = entry
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

const files = {
  'package.json': JSON.stringify(
    {
      name: packageName,
      version: '0.1.0',
      description: `${title} plugin for DeepSeek Harness.`,
      type: 'module',
      main: 'lib/index.js',
      types: 'lib/types/index.d.ts',
      exports: {
        '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
        './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
        './package.json': './package.json',
      },
      files: [
        'CHANGELOG.md',
        'cordis.patch.yml',
        'lib/index.js',
        'lib/client.js',
        'lib/types/**/*.d.ts',
      ],
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        client: {
          inject: [
            '@deepseek-ai/dsh-client-locale',
            '@deepseek-ai/dsh-client-ui-plugin-manager',
            '@deepseek-ai/dsh-client-ui-primitives',
            '@deepseek-ai/dsh-client-ui-settings',
          ],
          platform: 'web',
        },
      },
      scripts: {
        build: 'node ../../tooling/build/build-package.mjs .',
        typecheck: 'tsc -b tsconfig.json tsconfig.client.json',
        test: `pnpm run build && pnpm -w exec vitest run packages/${local}`,
        prepublishOnly: 'pnpm run build && pnpm run test',
      },
      license: 'MIT',
      author: 'hmilyld',
      repository: {
        type: 'git',
        url: 'git+https://github.com/hmilyld/dsh-plugins.git',
        directory: `packages/${local}`,
      },
      homepage: `https://github.com/hmilyld/dsh-plugins/tree/main/packages/${local}#readme`,
      bugs: { url: 'https://github.com/hmilyld/dsh-plugins/issues' },
      engines: { node: '^22.19.0 || >=24.0.0', dsh: '>=0.2.0-rc.2 <0.3.0' },
      publishConfig: { access: 'public' },
      peerDependencies: { '@deepseek-ai/cordis': '~4.0.4' },
      dependencies: {
        '@deepseek-ai/cosmokit': 'catalog:',
        '@deepseek-ai/schemastery': 'catalog:',
      },
      devDependencies: {
        '@deepseek-ai/cordis': 'catalog:',
        '@deepseek-ai/dsh-client-locale': 'catalog:',
        '@deepseek-ai/dsh-client-store': 'catalog:',
        '@deepseek-ai/dsh-client-ui-plugin-manager': 'catalog:',
        '@deepseek-ai/dsh-client-ui-primitives': 'catalog:',
        '@deepseek-ai/dsh-client-ui-renderer': 'catalog:',
        '@deepseek-ai/dsh-client-ui-settings': 'catalog:',
        '@deepseek-ai/dsh-client-ui-slots': 'catalog:',
        '@hmilyld/dsh-plugin-kit': 'workspace:*',
        '@types/node': 'catalog:',
        '@types/react': 'catalog:',
        react: 'catalog:',
        typescript: 'catalog:',
        vitest: 'catalog:',
      },
    },
    null,
    2,
  ) + '\n',

  'tsconfig.json': JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        rootDir: 'src',
        outDir: 'lib/types',
        types: ['node'],
        tsBuildInfoFile: 'tsconfig.tsbuildinfo',
      },
      include: ['src/index.ts', 'src/config.ts', 'src/constants.ts', 'src/types.ts'],
    },
    null,
    2,
  ) + '\n',

  'tsconfig.client.json': JSON.stringify(
    {
      extends: '../../tsconfig.base.client.json',
      compilerOptions: {
        rootDir: 'src/client',
        outDir: 'lib/types/client',
        tsBuildInfoFile: 'tsconfig.client.tsbuildinfo',
      },
      include: ['src/client/**/*.ts', 'src/client/**/*.tsx'],
    },
    null,
    2,
  ) + '\n',

  'tsdown.config.ts': `import { pluginConfig } from '../../tooling/tsdown.preset.mjs'

export default pluginConfig(import.meta.dirname, process.env.DSH_BUILD_FACE)
`,

  'src/constants.ts': `/** Default greeting shown by the scaffolded plugin. */
export const DEFAULT_GREETING = 'Hello from ${title}'
`,

  'src/config.ts': `/** Plugin configuration. */
import Schema from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'
import { DEFAULT_GREETING } from './constants.ts'

export interface Config {
  greeting: Volatile<string>
}

export const Config = Schema.object({
  greeting: Schema.string().default(DEFAULT_GREETING).volatile(),
})
`,

  'src/types.ts': `/** Values shared with the browser half. */
export interface PluginStatus {
  ready: boolean
}
`,

  'src/index.ts': `/** Host half of ${packageName}. */
import { isVolatile } from '@deepseek-ai/cosmokit'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import { Config } from './config.ts'
import type { Config as ConfigShape } from './config.ts'

export { Config }
export type * from './types.ts'

export const name = '${entry}'
export const inject: string[] = []

function read<T>(value: Volatile<T> | T): T {
  return isVolatile(value) ? ((value as Volatile<T>).get() as T) : (value as T)
}

/** Log the configured greeting once at activation. */
export function apply(ctx: Context, config: ConfigShape): void {
  ctx.logger('${entry}').info(read(config.greeting))
}
`,

  'src/client/globals.d.ts': `/** Version injected by the shared tsdown preset from package.json. */
declare const __PKG_VERSION__: string
/** Changelog URL injected by the shared tsdown preset. */
declare const __PKG_CHANGELOG_URL__: string
`,

  'src/client/locales.ts': `/** Locale bundles for the settings card. */
import type { CommonLocaleKey } from '@hmilyld/dsh-plugin-kit'

export const NS = 'settings.${entry}'

export type LocaleKey =
  | CommonLocaleKey
  | 'description'
  | 'greeting'
  | 'greetingHint'
  | 'invalidValue'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.${entry}': LocaleKey
  }
}

export const en: Record<LocaleKey, string> = {
  description: 'Configure ${title}.',
  greeting: 'Greeting',
  greetingHint: 'Text logged when the plugin activates.',
  invalidValue: 'Enter a value.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values.',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  updateAvailable: 'A newer release v{latest} is available (running v{current}).',
  updateChangelog: 'View release notes',
}

export const zh: Record<LocaleKey, string> = {
  description: '配置 ${title}。',
  greeting: '问候语',
  greetingHint: '插件激活时写入日志的文本。',
  invalidValue: '请填写一个值。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值。',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载。',
  overridden: '已覆盖',
  reset: '恢复默认',
  updateAvailable: '发现新版本 v{latest}（当前 v{current}）。',
  updateChangelog: '查看更新说明',
}
`,

  'src/client/controller.ts': `/** Settings form state and controller. */
import {
  createUpdateStore,
  SettingsFormModel,
  settingsTextField,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
  type SettingsFormShell,
  type Store,
  type UpdateStore,
} from '@hmilyld/dsh-plugin-kit'

export const ENTRY_ID = '${entry}'
export const BUNDLE_KEY = '${packageName}'

export interface PluginConfig {
  greeting?: string
}

export interface CardState extends SettingsFormShell {
  greeting: SettingsFieldState
}

export interface Face extends SettingsFormActions {
  hooks: {
    card: Store<CardState>
    update: UpdateStore
  }
}

export class Controller {
  private readonly form: SettingsFormModel<PluginConfig>
  private readonly store
  private readonly updates = createUpdateStore({
    packageName: BUNDLE_KEY,
    currentVersion: __PKG_VERSION__,
  })

  constructor(scope: SettingsFormScope<PluginConfig>) {
    this.form = new SettingsFormModel<PluginConfig>(scope, [settingsTextField('greeting')])
    this.store = this.form.bind(() => this.projection())
    void this.updates.refresh(false)
  }

  private projection(): CardState {
    return { ...this.form.shell(), greeting: this.form.field('greeting') }
  }

  face(): Face {
    return {
      hooks: { card: this.store, update: this.updates },
      ...this.form.actions(),
    }
  }

  dispose(): void {
    this.form.dispose()
  }
}
`,

  'src/client/settings.tsx': `/** Settings card. */
import { formLabels, PluginSettingsForm, SettingsValueField } from '@hmilyld/dsh-plugin-kit'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { Face } from './controller.ts'
import { NS, type LocaleKey } from './locales.ts'

export type SettingsCardProps = PropsRuntime<'plugins.bundle.config'> &
  PropsLocale<typeof NS> &
  InjectFace<Face>

export function SettingsCard(props: SettingsCardProps) {
  const t = props.t as (key: LocaleKey) => string
  if (props.view === 'summary') return <>{t('description')}</>
  const state = props.useCard((value) => value)
  const update = props.useUpdate((value) => value)
  const disabled = !state.writable || state.saving
  return (
    <PluginSettingsForm
      state={state}
      labels={formLabels(t)}
      onSave={props.save}
      onDiscard={props.discard}
      update={update}
      changelogUrl={__PKG_CHANGELOG_URL__}
      updateLabels={{ available: t('updateAvailable'), changelog: t('updateChangelog') }}
    >
      <SettingsValueField
        id="${entry}-greeting"
        label={t('greeting')}
        hint={t('greetingHint')}
        text={state.greeting.text}
        overridden={state.greeting.overridden}
        invalid={state.greeting.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidValue')}
        disabled={disabled}
        onEdit={(text) => props.edit('greeting', text)}
        onReset={() => props.resetField('greeting')}
      />
    </PluginSettingsForm>
  )
}
`,

  'src/client/index.tsx': `/** Browser entry. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BUNDLE_KEY, Controller, ENTRY_ID, type PluginConfig } from './controller.ts'
import { en, NS, zh } from './locales.ts'
import { SettingsCard } from './settings.tsx'

export const inject = ['slots', 'configForms', 'locale']

export function apply(ctx: Context): void {
  const controller = new Controller(ctx.configForms.get<PluginConfig>(ENTRY_ID))
  ctx.effect(() => () => controller.dispose(), '${entry}: settings form')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), '${entry}: dictionaries')
  ctx.effect(
    () =>
      ctx.configForms.whileServed([ENTRY_ID], () =>
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.bundle.config',
              key: BUNDLE_KEY,
              locale: NS,
              inject: () => controller.face(),
            },
            SettingsCard,
          ),
        ),
      ),
    '${entry}: plugin config page',
  )
}
`,

  'tests/manifest.spec.ts': `import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

describe('package manifest', () => {
  it('publishes the standard layout', () => {
    expect(pkg.main).toBe('lib/index.js')
    expect(pkg.types).toBe('lib/types/index.d.ts')
    expect(pkg.exports['./client'].default).toBe('./lib/client.js')
    expect(pkg.files).toContain('lib/index.js')
    expect(pkg.files).toContain('lib/client.js')
    expect(pkg.files).toContain('CHANGELOG.md')
  })
})
`,

  'tests/logic.spec.ts': `import { describe, expect, it } from 'vitest'
import { DEFAULT_GREETING } from '../src/constants.ts'

describe('constants', () => {
  it('has a greeting', () => {
    expect(DEFAULT_GREETING.length).toBeGreaterThan(0)
  })
})
`,

  'cordis.patch.yml': `# ${packageName} bundle layer.
- insert:
    - id: ${entry}
      name: '${packageName}'
      config:
        greeting: 'Hello from ${title}'
`,

  'README.md': `# ${packageName}

${title} plugin for DeepSeek Harness.

## Install

\`\`\`bash
dsh plugin --profile web add ${packageName}
\`\`\`

Restart \`dsh web\` once after install.

## Configure

Open **Plugins → ${packageName}**. The settings page uses the shared
\`@hmilyld/dsh-plugin-kit\` shell and shows an npm update notice when a newer
release is available.

## Development

\`\`\`bash
pnpm install
pnpm --filter ${packageName} run build
pnpm --filter ${packageName} run test
\`\`\`

## License

MIT
`,

  'README.zh.md': `# ${packageName}

DeepSeek Harness 的 ${title} 插件。

## 安装

\`\`\`bash
dsh plugin --profile web add ${packageName}
\`\`\`

安装后重启一次 \`dsh web\`。

## 配置

打开 **插件 → ${packageName}**。设置页使用共享的
\`@hmilyld/dsh-plugin-kit\` 外壳，有新版本时会显示 npm 更新提示。

## 开发

\`\`\`bash
pnpm install
pnpm --filter ${packageName} run build
pnpm --filter ${packageName} run test
\`\`\`

## License

MIT
`,

  'CHANGELOG.md': `# ${packageName}

## 0.1.0

- 初始版本：由 \`pnpm gen:plugin\` 生成的标准插件骨架。
`,
}

for (const [path, content] of Object.entries(files)) {
  const file = join(packageDir, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/** Add one project reference without duplicating an existing one. */
function addReference(configPath, reference) {
  const data = JSON.parse(readFileSync(configPath, 'utf8'))
  data.references ??= []
  if (!data.references.some((item) => item.path === reference.path)) {
    data.references.push(reference)
  }
  writeFileSync(configPath, JSON.stringify(data, null, 2) + '\n')
}

addReference(join(root, 'tsconfig.host.json'), { path: `./packages/${local}` })
addReference(join(root, 'tsconfig.client.json'), { path: `./packages/${local}/tsconfig.client.json` })

console.log(`created packages/${local}`)
console.log('next: pnpm install && pnpm --filter ' + packageName + ' run test')
