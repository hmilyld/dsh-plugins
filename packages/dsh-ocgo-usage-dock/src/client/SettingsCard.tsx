/** The plugin's page on the Plugins screen. */
import {
  formLabels,
  PluginSettingsForm,
  SettingsCredentialField,
  SettingsToggleField,
  SettingsValueField,
} from '@hmilyld/dsh-plugin-kit'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsFace } from './controller.ts'
import { NS, type OcgoLocaleKey } from './locales.ts'

/** Props the bundle config slot hands the card. */
export type SettingsCardProps = PropsRuntime<'plugins.bundle.config'> &
  PropsLocale<typeof NS> &
  InjectFace<SettingsFace>

/**
 * Render the settings page.
 * @param props - slot runtime props, locale reader, form state, and actions.
 * @returns the summary line on the bundle page, or the full form on its page.
 */
export function SettingsCard(props: SettingsCardProps) {
  const t = props.t as (key: OcgoLocaleKey) => string
  if (props.view === 'summary') return <>{t('description')}</>

  const state = props.useSettings((value) => value)
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
      updateLabels={{
        available: t('updateAvailable'),
        changelog: t('updateChangelog'),
      }}
    >
      <SettingsValueField
        id="ocgo-api-key-env"
        label={t('apiKeyEnv')}
        hint={t('apiKeyEnvHint')}
        text={state.apiKeyEnv.text}
        overridden={state.apiKeyEnv.overridden}
        invalid={state.apiKeyEnv.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidValue')}
        disabled={disabled}
        onEdit={(text) => props.edit('apiKeyEnv', text)}
        onReset={() => props.resetField('apiKeyEnv')}
        placeholder="OPENCODE_GO_API_KEY"
      />
      <SettingsCredentialField
        id="ocgo-api-key"
        label={t('apiKey')}
        hint={t('apiKeyHint')}
        text={state.apiKeyDraft.text}
        disabled={disabled || !state.credentialWritable}
        configured={state.credentialConfigured}
        stateLabel={state.credentialConfigured ? t('apiKeySet') : t('apiKeyUnset')}
        onEdit={(text) => props.edit('apiKeyDraft', text)}
        legacy={{
          visible: state.legacyApiKey,
          message: t('legacyNotice'),
          actionLabel: state.legacyClearBusy ? t('clearingLegacy') : t('clearLegacy'),
          onClear: props.clearLegacyKey,
          disabled: disabled || state.legacyClearBusy,
          ...(state.legacyClearFailed ? { failed: t('legacyClearFailed') } : {}),
        }}
      />
      <SettingsValueField
        id="ocgo-refresh-seconds"
        label={t('refreshSeconds')}
        hint={t('refreshSecondsHint')}
        text={state.refreshSeconds.text}
        overridden={state.refreshSeconds.overridden}
        invalid={state.refreshSeconds.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidRefresh')}
        disabled={disabled}
        numeric
        onEdit={(text) => props.edit('refreshIntervalMs', text)}
        onReset={() => props.resetField('refreshIntervalMs')}
      />
      <SettingsValueField
        id="ocgo-timeout-seconds"
        label={t('timeoutSeconds')}
        hint={t('timeoutSecondsHint')}
        text={state.timeoutSeconds.text}
        overridden={state.timeoutSeconds.overridden}
        invalid={state.timeoutSeconds.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidTimeout')}
        disabled={disabled}
        numeric
        onEdit={(text) => props.edit('timeoutMs', text)}
        onReset={() => props.resetField('timeoutMs')}
      />
      <SettingsValueField
        id="ocgo-base-url"
        label={t('baseUrl')}
        hint={t('baseUrlHint')}
        text={state.baseUrl.text}
        overridden={state.baseUrl.overridden}
        invalid={state.baseUrl.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidValue')}
        disabled={disabled}
        onEdit={(text) => props.edit('baseUrl', text)}
        onReset={() => props.resetField('baseUrl')}
        placeholder="https://opencode.ai/zen/go/v1/usage"
      />
      <SettingsToggleField
        id="ocgo-show-bars"
        label={t('showBars')}
        hint={t('showBarsHint')}
        checked={state.showBars.text !== 'false'}
        overridden={state.showBars.overridden}
        disabled={disabled}
        onToggle={(next) => props.edit('showBars', String(next))}
        onReset={() => props.resetField('showBars')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        spaced
      />
    </PluginSettingsForm>
  )
}
