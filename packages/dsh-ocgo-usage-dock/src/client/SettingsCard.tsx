/** The plugin's page on the Plugins screen. */
import type { CSSProperties } from 'react'
import {
  SettingsForm,
  SettingsSecretField,
  SettingsValueField,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsFace } from './controller.ts'
import { formLabels, NS, type OcgoLocaleKey } from './locales.ts'

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
  const disabled = !state.writable || state.saving
  return (
    <SettingsForm
      labels={formLabels(t)}
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
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
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        onEdit={(text) => props.edit('apiKeyEnv', text)}
        onReset={() => props.resetField('apiKeyEnv')}
        placeholder="OPENCODE_GO_API_KEY"
      />
      <SettingsSecretField
        id="ocgo-api-key"
        label={t('apiKey')}
        hint={t('apiKeyHint')}
        text={state.apiKeyDraft.text}
        disabled={disabled || !state.credentialWritable}
        onEdit={(text) => props.edit('apiKeyDraft', text)}
        configured={state.credentialConfigured}
        stateLabel={state.credentialConfigured ? t('apiKeySet') : t('apiKeyUnset')}
      />
      {state.legacyApiKey ? (
        <div style={styles.notice}>
          <span>{t('legacyNotice')}</span>
          <button type="button" style={styles.noticeButton} onClick={props.clearLegacyKey} disabled={disabled}>
            {t('clearLegacy')}
          </button>
        </div>
      ) : null}
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
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        onEdit={(text) => props.edit('baseUrl', text)}
        onReset={() => props.resetField('baseUrl')}
        placeholder="https://opencode.ai/zen/go/v1/usage"
      />
    </SettingsForm>
  )
}

const styles: Record<string, CSSProperties> = {
  notice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--dsw-alias-state-warning-border, #f59e0b)',
    background: 'var(--dsw-alias-state-warning-bg, rgba(245, 158, 11, 0.08))',
    color: 'var(--dsw-alias-label-secondary, #6b7280)',
    fontSize: 12,
    lineHeight: '18px',
  },
  noticeButton: {
    appearance: 'none',
    border: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
    background: 'transparent',
    color: 'var(--dsw-alias-label-primary, #111827)',
    borderRadius: 6,
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: 12,
  },
}
