/**
 * Browser entry for the usage dock.
 *
 * The generated Remote contribution is mounted once per Client plugin; a
 * scoped injection then waits for the namespace it created before the UI
 * controller touches `ctx.remote.ocgoUsage`. Both slot registrations wait for
 * the Host to serve the entry's settings namespace, so a profile that does not
 * load the Host half shows no trace of the dock or the card.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import ocgoRemote from '@hmilyld/dsh-ocgo-usage-dock/remote'
import { OcgoClientController, ENTRY_ID, PACKAGE_NAME } from './controller.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { UsageDock } from './UsageDock.tsx'
import { en, NS, zh } from './locales.ts'

/** `remote` alone is enough to mount the contribution; the namespace is scoped below. */
export const inject = ['remote']

/**
 * Mount the Remote contribution, then wait for its namespace before wiring UI.
 * @param ctx - Client plugin context.
 * @returns the Remote contribution disposer.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(ocgoRemote)
  const ui = ctx.inject(
    ['remote.ocgoUsage', 'remote.credentials', 'slots', 'locale', 'configForms', 'pluginNavigation'],
    (scoped) => {
      mountUi(scoped)
    },
  )
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

/** Register the controller, dictionaries, and both slots on the scoped context. */
function mountUi(ctx: Context): void {
  const controller = new OcgoClientController(ctx)
  // The official composer dock is a single non-wrapping flex row. Let it wrap
  // so the full-width usage row can sit on the line below the token meter.
  //
  // The official tree renders this slot BEFORE the built-in ContextMeter, so
  // the meter stays the dock's last DOM child. `order: 10` on the row (see
  // UsageDock) is what puts it after the meter visually; the dock's `gap`
  // would otherwise leave a blank line, hence the tighter row gap.
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.ocgoUsageDock = ''
    style.textContent = '[data-composer-dock]{flex-wrap:wrap;row-gap:2px}'
    document.head.appendChild(style)
    return () => style.remove()
  }, 'ocgo-usage-dock: composer dock wrap')
  ctx.effect(() => () => controller.dispose(), 'ocgo-usage-dock: controller')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ocgo-usage-dock: dictionaries')
  ctx.effect(
    () =>
      ctx.configForms.whileServed([ENTRY_ID], () => {
        const offDock = ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'ocgo-usage-dock',
              order: 10,
              locale: NS,
              inject: () => controller.dockFace(),
            },
            UsageDock,
          ),
        )
        const offSettings = ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.bundle.config',
              key: PACKAGE_NAME,
              locale: NS,
              inject: () => controller.settingsFace(),
            },
            SettingsCard,
          ),
        )
        return () => {
          offSettings()
          offDock()
        }
      }),
    'ocgo-usage-dock: slots',
  )
}
