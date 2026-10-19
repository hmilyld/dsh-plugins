/**
 * Browser entry for the beacon settings card.
 *
 * The card waits for the Host to serve the `dsh-beacon` settings namespace and
 * registers into the Plugins page's bundle config slot. All copy is localized.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BeaconController, BUNDLE_KEY, ENTRY_ID } from './controller.ts'
import { en, NS, zh } from './locales.ts'
import { BeaconCard } from './settings.tsx'

/** Services required before the card can render. */
export const inject = ['slots', 'configForms', 'locale']

/** Register the controller, dictionaries, and bundle config slot. */
export function apply(ctx: Context): void {
  const controller = new BeaconController(ctx.configForms.get(ENTRY_ID))
  ctx.effect(() => () => controller.dispose(), 'dsh-beacon: settings form')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-beacon: dictionaries')
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
            BeaconCard,
          ),
        ),
      ),
    'dsh-beacon: plugin config page',
  )
}
