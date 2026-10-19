/** Beacon settings form state and controller. */
import {
  createUpdateStore,
  SettingsFormModel,
  settingsBooleanField,
  settingsNumberField,
  settingsTextField,
  type SettingsFieldSpec,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
  type SettingsFormShell,
  type Store,
  type UpdateStore,
} from '@hmilyld/dsh-plugin-kit'

/** Loader entry id; also the settings namespace. */
export const ENTRY_ID = 'dsh-beacon'

/** Bundle package name; `plugins.bundle.config` is keyed by it. */
export const BUNDLE_KEY = '@hmilyld/dsh-beacon'

/** Host section shape as seen by the browser. */
export interface BeaconConfig {
  webhookUrl: string
  payloadTemplate: string
  headers: Record<string, string>
  triggerOnUserQuestion: boolean
  dedupWindowMs: number
  skipSubagents: boolean
}

/** Card projection: form shell plus the six fields. */
export type BeaconCardState = SettingsFormShell & {
  webhookUrl: SettingsFieldState
  payloadTemplate: SettingsFieldState
  headers: SettingsFieldState
  triggerOnUserQuestion: SettingsFieldState
  dedupWindowMs: SettingsFieldState
  skipSubagents: SettingsFieldState
}

/** The slot's injected face. */
export interface BeaconFace extends SettingsFormActions {
  hooks: {
    beaconCard: Store<BeaconCardState>
    update: UpdateStore
  }
}

/** Request headers are edited as a JSON object of string values. */
const headersSpec: SettingsFieldSpec = {
  field: 'headers',
  format: (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? JSON.stringify(value)
      : '',
  parse: (text) => {
    if (text.trim() === '') return { kind: 'clear' }
    try {
      const parsed: unknown = JSON.parse(text)
      const isStringDict =
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Object.values(parsed as Record<string, unknown>).every((value) => typeof value === 'string')
      if (isStringDict) return { kind: 'set', value: parsed }
    } catch {
      // Invalid JSON leaves the draft invalid and blocks the save.
    }
    return undefined
  },
}

/** Owns the staged form and the shared update store. */
export class BeaconController {
  private readonly form: SettingsFormModel<BeaconConfig>
  private readonly store
  private readonly updates = createUpdateStore({
    packageName: BUNDLE_KEY,
    currentVersion: __PKG_VERSION__,
  })

  constructor(scope: SettingsFormScope<BeaconConfig>) {
    this.form = new SettingsFormModel<BeaconConfig>(scope, [
      settingsTextField('webhookUrl'),
      settingsTextField('payloadTemplate'),
      headersSpec,
      settingsBooleanField('triggerOnUserQuestion'),
      settingsNumberField('dedupWindowMs'),
      settingsBooleanField('skipSubagents'),
    ])
    this.store = this.form.bind(() => this.projection())
    void this.updates.refresh(false)
  }

  private projection(): BeaconCardState {
    return {
      ...this.form.shell(),
      webhookUrl: this.form.field('webhookUrl'),
      payloadTemplate: this.form.field('payloadTemplate'),
      headers: this.form.field('headers'),
      triggerOnUserQuestion: this.form.field('triggerOnUserQuestion'),
      dedupWindowMs: this.form.field('dedupWindowMs'),
      skipSubagents: this.form.field('skipSubagents'),
    }
  }

  face(): BeaconFace {
    return {
      hooks: { beaconCard: this.store, update: this.updates },
      ...this.form.actions(),
    }
  }

  dispose(): void {
    this.form.dispose()
  }
}
