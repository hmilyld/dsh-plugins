/** Standard settings shell: the official form plus the update notice. */
import type { ReactNode } from 'react'
import {
  SettingsForm,
  type SettingsFormLabels,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { UpdateNotice } from '../updates/UpdateNotice.tsx'
import type { UpdateNoticeLabels, UpdateStatus } from '../updates/types.ts'

/** Props for {@link PluginSettingsForm}. */
export interface PluginSettingsFormProps {
  /** Form state from `SettingsFormModel.shell()` plus the card's projection. */
  state: SettingsFormShell
  /** Frame copy from {@link import('./labels.ts').formLabels}. */
  labels: SettingsFormLabels
  /** Write every staged edit. */
  onSave: () => void
  /** Drop every staged edit. */
  onDiscard: () => void
  /** Update state; when present with the other update props, the notice is rendered first. */
  update?: UpdateStatus
  /** Changelog address for the update notice. */
  changelogUrl?: string
  /** Localized update notice copy. */
  updateLabels?: UpdateNoticeLabels
  /** The plugin's fields. */
  children: ReactNode
}

/**
 * Render the standard plugin settings page.
 * @param props - form state/actions, optional update state, and fields.
 * @returns the official form frame with the update notice on top.
 */
export function PluginSettingsForm(props: PluginSettingsFormProps) {
  const notice =
    props.update !== undefined && props.changelogUrl !== undefined && props.updateLabels !== undefined ? (
      <UpdateNotice
        state={props.update}
        changelogUrl={props.changelogUrl}
        labels={props.updateLabels}
      />
    ) : null
  return (
    <SettingsForm
      labels={props.labels}
      state={props.state}
      onSave={props.onSave}
      onDiscard={props.onDiscard}
    >
      {notice}
      {props.children}
    </SettingsForm>
  )
}
