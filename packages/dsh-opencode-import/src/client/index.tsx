/**
 * Browser entry for the OpenCode importer.
 *
 * The generated Remote contribution is mounted once per Client plugin; a
 * scoped injection then waits for the namespace it created before any UI talks
 * to `ctx.remote.opencodeImport`. Row decoration and the divergence notice need
 * only the slot and locale services, while the settings card additionally waits
 * for the Host to serve the entry's settings namespace.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import opencodeRemote from '@hmilyld/dsh-opencode-import/remote'
import { BUNDLE_KEY, ENTRY_ID } from './constants.ts'
import { ImportClientController } from './controller.ts'
import { ImportedMark } from './ImportedMark.tsx'
import { ImportNotice } from './ImportNotice.tsx'
import { en, NS, zh } from './locales.ts'
import { SettingsCard } from './SettingsCard.tsx'

/** `remote` alone is enough to mount the contribution; the namespace is scoped below. */
export const inject = ['remote']

/**
 * Mount the Remote contribution, then wait for its namespace before wiring UI.
 * @param ctx - Client plugin context.
 * @returns the Remote contribution disposer.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(opencodeRemote)
  const ui = ctx.inject(['remote.opencodeImport', 'slots', 'locale', 'configForms', 'sessions'], (scoped) => {
    mountUi(scoped)
  })
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await disposeRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await disposeRemote()
  }
}

/** Register the controller, dictionaries, settings page, row mark, and notice. */
function mountUi(ctx: Context): void {
  const controller = new ImportClientController(ctx)
  ctx.effect(() => () => controller.dispose(), 'opencode-import: controller')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'opencode-import: dictionaries')
  // Row decoration and the divergence notice do not read settings, so they
  // register as soon as the slot and locale services exist; gating them on the
  // Host settings namespace would hide them whenever that page is unavailable.
  ctx.effect(() => {
    const offMark = ctx.slots.inject('sidebar.session.row.leading', () =>
      ctx.slots.register(
        {
          name: 'sidebar.session.row.leading',
          id: 'opencode-import',
          order: 5,
          locale: NS,
          inject: () => ({
            requestTitleRepair: (sessionId: string) => controller.requestTitleRepair(sessionId),
          }),
        },
        ImportedMark,
      ),
    )
    const offNotice = ctx.slots.inject('conversation.input.dock', () =>
      ctx.slots.register(
        {
          name: 'conversation.input.dock',
          id: 'opencode-import-notice',
          order: 5,
          locale: NS,
        },
        ImportNotice,
      ),
    )
    return () => {
      offNotice()
      offMark()
    }
  }, 'opencode-import: decorations')

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
    'opencode-import: settings page',
  )
}
