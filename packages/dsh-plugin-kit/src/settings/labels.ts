/** Locale keys every plugin settings page shares. */
import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys every plugin settings page shares. */
export type CommonLocaleKey =
  | 'save'
  | 'saving'
  | 'saveFailed'
  | 'readOnly'
  | 'unavailable'
  | 'overridden'
  | 'reset'
  | 'updateAvailable'
  | 'updateChangelog'

/**
 * Build the form frame's copy from a plugin dictionary that includes the common keys.
 * @param t - namespace-bound translator.
 * @returns labels for the official `SettingsForm`.
 */
export function formLabels(t: (key: CommonLocaleKey) => string): SettingsFormLabels {
  return {
    unavailable: t('unavailable'),
    readOnly: t('readOnly'),
    saveFailed: t('saveFailed'),
    save: t('save'),
    saving: t('saving'),
  }
}
