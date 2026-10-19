/**
 * Shared client kit for `@hmilyld` DSH plugins.
 *
 * - `updates`: npm registry update detection and the settings notice.
 * - `settings`: the standard plugin settings shell and field controls.
 *
 * The kit is private to this monorepo and is bundled into each plugin's client
 * artifact; it is never loaded as a separate module.
 */
export { compareVersions, isNewerVersion, parseVersion } from './updates/version.ts'
export type { ParsedVersion } from './updates/version.ts'
export { createUpdateStore } from './updates/store.ts'
export type { UpdateStoreOptions } from './updates/store.ts'
export { UpdateNotice } from './updates/UpdateNotice.tsx'
export type { UpdateNoticeProps } from './updates/UpdateNotice.tsx'
export type { UpdateNoticeLabels, UpdateStatus, UpdateStore } from './updates/types.ts'

export { PluginSettingsForm } from './settings/PluginSettingsForm.tsx'
export type { PluginSettingsFormProps } from './settings/PluginSettingsForm.tsx'
export { SettingsTextareaField } from './settings/SettingsTextareaField.tsx'
export type { SettingsTextareaFieldProps } from './settings/SettingsTextareaField.tsx'
export { SettingsToggleField } from './settings/SettingsToggleField.tsx'
export type { SettingsToggleFieldProps } from './settings/SettingsToggleField.tsx'
export { SettingsCredentialField } from './settings/SettingsCredentialField.tsx'
export type {
  LegacyCredentialNotice,
  SettingsCredentialFieldProps,
} from './settings/SettingsCredentialField.tsx'
export { settingsBooleanField, settingsSecondsField } from './settings/fields.ts'
export { createStore } from './settings/store.ts'
export type { Store, WritableStore } from './settings/store.ts'
export { formLabels } from './settings/labels.ts'
export type { CommonLocaleKey } from './settings/labels.ts'

// Re-export the official form primitives so plugins have one import surface.
export {
  SettingsFormModel,
  SettingsSecretField,
  SettingsValueField,
  settingsNumberField,
  settingsTextField,
} from '@deepseek-ai/dsh-client-ui-primitives'
export type {
  SettingsFieldProps,
  SettingsFieldSpec,
  SettingsFieldState,
  SettingsFormActions,
  SettingsFormLabels,
  SettingsFormScope,
  SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
