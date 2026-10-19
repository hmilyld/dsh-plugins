/** Beacon settings card. */
import {
  formLabels,
  PluginSettingsForm,
  SettingsTextareaField,
  SettingsToggleField,
  SettingsValueField,
} from '@hmilyld/dsh-plugin-kit'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BeaconConfig, BeaconFace } from './controller.ts'
import { NS, type BeaconLocaleKey } from './locales.ts'

/** Props the bundle config slot hands the card. */
export type BeaconCardProps = PropsRuntime<'plugins.bundle.config'> &
  PropsLocale<typeof NS> &
  InjectFace<BeaconFace>

/**
 * Render the settings page.
 * @param props - slot runtime props, locale reader, form state, and actions.
 * @returns the summary line or the full form.
 */
export function BeaconCard(props: BeaconCardProps) {
  const t = props.t as (key: BeaconLocaleKey) => string
  if (props.view === 'summary') return <>{t('description')}</>

  const state = props.useBeaconCard((value) => value)
  const update = props.useUpdate((value) => value)
  const disabled = !state.writable || state.saving
  const edit =
    (field: keyof BeaconConfig) =>
    (text: string): void => {
      props.edit(field, text)
    }
  const reset = (field: keyof BeaconConfig) => (): void => {
    props.resetField(field)
  }

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
        id="beacon-webhook-url"
        label={t('webhookUrl')}
        hint={t('webhookUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidValue')}
        disabled={disabled}
        {...state.webhookUrl}
        onEdit={edit('webhookUrl')}
        onReset={reset('webhookUrl')}
      />
      <SettingsTextareaField
        id="beacon-payload-template"
        label={t('payloadTemplate')}
        hint={t('payloadTemplateHint')}
        rows={5}
        spaced
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidJson')}
        disabled={disabled}
        {...state.payloadTemplate}
        onEdit={edit('payloadTemplate')}
        onReset={reset('payloadTemplate')}
      />
      <SettingsTextareaField
        id="beacon-headers"
        label={t('headers')}
        hint={t('headersHint')}
        rows={3}
        spaced
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidJson')}
        disabled={disabled}
        {...state.headers}
        onEdit={edit('headers')}
        onReset={reset('headers')}
      />
      <SettingsToggleField
        id="beacon-question"
        label={t('triggerOnUserQuestion')}
        hint={t('triggerOnUserQuestionHint')}
        spaced
        checked={state.triggerOnUserQuestion.text === 'true'}
        overridden={state.triggerOnUserQuestion.overridden}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        onToggle={(next) => edit('triggerOnUserQuestion')(String(next))}
        onReset={reset('triggerOnUserQuestion')}
      />
      <SettingsToggleField
        id="beacon-subagents"
        label={t('skipSubagents')}
        hint={t('skipSubagentsHint')}
        spaced
        checked={state.skipSubagents.text === 'true'}
        overridden={state.skipSubagents.overridden}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        onToggle={(next) => edit('skipSubagents')(String(next))}
        onReset={reset('skipSubagents')}
      />
      <div style={{ borderTop: '0.5px solid var(--dsw-alias-border-l2)' }}>
        <SettingsValueField
          id="beacon-dedup"
          label={t('dedupWindowMs')}
          hint={t('dedupWindowMsHint')}
          numeric
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('invalidNumber')}
          disabled={disabled}
          {...state.dedupWindowMs}
          onEdit={edit('dedupWindowMs')}
          onReset={reset('dedupWindowMs')}
        />
      </div>
    </PluginSettingsForm>
  )
}
