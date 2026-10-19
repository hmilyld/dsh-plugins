/**
 * Browser-side controller for the dock and the settings card.
 *
 * One controller per Client plugin owns:
 *   - the staged settings form over the Host entry namespace,
 *   - the credentials describe/write pair for the reference the form names,
 *   - the single polling loop, and
 *   - the two snapshot stores the slot components read.
 *
 * Keeping the loop here rather than in each session-scoped dock instance means
 * the dock renders in every session while the network sees one client.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  SettingsFormModel,
  settingsTextField,
  type SettingsFieldSpec,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageSnapshot } from '@hmilyld/dsh-ocgo-usage-dock/types'
import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_REFRESH_INTERVAL_MS,
  MIN_REFRESH_INTERVAL_MS,
  MIN_TIMEOUT_MS,
} from './constants.ts'
import { createStore, type Store, type WritableStore } from './store.ts'

/** Loader entry id; also the settings namespace this plugin serves. */
export const ENTRY_ID = 'ocgo-usage-dock'

/** Bundle package name keyed by the Plugins page's bundle card. */
export const PACKAGE_NAME = '@hmilyld/dsh-ocgo-usage-dock'

/** Form field that stages the write-only credential. */
const SECRET_FIELD = 'apiKeyDraft'

/** What the browser sees of one Host section value. */
export interface PluginConfig {
  apiKey?: string
  apiKeyEnv?: string
  refreshIntervalMs?: number
  timeoutMs?: number
  baseUrl?: string
}

/** What the dock renders. */
export interface UsageDockState {
  /** Last Host answer; null before the first reply. */
  snapshot: UsageSnapshot | null
  /** Whether a request is crossing the wire. */
  loading: boolean
  /** Transport or assembly failure; Host-reported usage errors live in `snapshot`. */
  transportError: string | null
}

/** What the settings card renders. */
export interface SettingsState extends SettingsFormShell {
  apiKeyEnv: SettingsFieldState
  refreshSeconds: SettingsFieldState
  timeoutSeconds: SettingsFieldState
  baseUrl: SettingsFieldState
  apiKeyDraft: SettingsFieldState
  credentialConfigured: boolean
  credentialWritable: boolean
  legacyApiKey: boolean
}

/** The dock slot's injected face. */
export interface DockFace {
  hooks: {
    usageDock: Store<UsageDockState>
  }
  refresh: () => void
  openSettings: () => void
}

/** The settings card's injected face. */
export interface SettingsFace extends SettingsFormActions {
  hooks: {
    settings: Store<SettingsState>
  }
  clearLegacyKey: () => void
}

/** What the credentials domain last reported, and for which reference. */
interface CredentialState {
  ref: string
  configured: boolean
  writable: boolean
}

/** A whole-second field stored as milliseconds. */
function secondsField(field: string, minimumSeconds: number): SettingsFieldSpec {
  return {
    field,
    format: (value) =>
      typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value / 1000)) : '',
    parse: (text) => {
      if (text.trim() === '') return { kind: 'clear' }
      const seconds = Number(text)
      return Number.isInteger(seconds) && seconds >= minimumSeconds
        ? { kind: 'set', value: seconds * 1000 }
        : undefined
    },
  }
}

/** Bridges the Host settings scope, credentials domain, and Remote onto the UI. */
export class OcgoClientController {
  private readonly form: SettingsFormModel<PluginConfig>
  private readonly scope: SettingsFormScope<PluginConfig>
  private readonly dockStore = createStore<UsageDockState>({
    snapshot: null,
    loading: false,
    transportError: null,
  })

  private readonly settingsStore: WritableStore<SettingsState>
  private readonly unsubscribers: (() => void)[] = []
  private credential: CredentialState = { ref: DEFAULT_API_KEY_ENV, configured: false, writable: true }
  private timer: ReturnType<typeof setTimeout> | undefined
  private inflight: Promise<void> | undefined
  private disposed = false

  /**
   * @param ctx - the Client plugin context, mounted Remote included.
   */
  constructor(private readonly ctx: ClientContext) {
    this.scope = ctx.configForms.get<PluginConfig>(ENTRY_ID)
    this.form = new SettingsFormModel<PluginConfig>(
      this.scope,
      [
        settingsTextField('apiKeyEnv'),
        // Kept only so the migration notice can stage a clear; never rendered.
        settingsTextField('apiKey'),
        secondsField('refreshIntervalMs', MIN_REFRESH_INTERVAL_MS / 1000),
        secondsField('timeoutMs', MIN_TIMEOUT_MS / 1000),
        settingsTextField('baseUrl'),
      ],
      [{ field: SECRET_FIELD, write: (text) => this.writeKey(text) }],
    )
    this.settingsStore = createStore(this.projection())

    // The form's own projection publishes on scope and draft changes; mirror it
    // into the credential and legacy-aware projection the card reads.
    const formStore = this.form.bind(() => this.form.shell())
    this.unsubscribers.push(formStore.subscribe(() => this.publish()))
    this.unsubscribers.push(
      this.scope.subscribe(() => {
        this.reschedule()
        void this.refresh(true)
      }),
    )

    this.publish()
    void this.readCredential()
    void this.refresh(false)
  }

  /** The dock slot's injected face. */
  dockFace(): DockFace {
    return {
      hooks: { usageDock: this.dockStore },
      refresh: () => {
        void this.refresh(true)
      },
      openSettings: () => {
        this.ctx.pluginNavigation.openBundle(PACKAGE_NAME)
      },
    }
  }

  /** The settings card's injected face. */
  settingsFace(): SettingsFace {
    const actions = this.form.actions()
    return {
      hooks: { settings: this.settingsStore },
      edit: actions.edit,
      resetField: actions.resetField,
      save: actions.save,
      discard: actions.discard,
      clearLegacyKey: () => {
        this.form.actions().resetField('apiKey')
        this.form.actions().save()
      },
    }
  }

  /** Release timers, subscriptions, and the form's scope subscription. */
  dispose(): void {
    this.disposed = true
    this.stopTimer()
    for (const off of this.unsubscribers.splice(0)) off()
    this.form.dispose()
  }

  /** Build the settings projection from the form, credentials, and last snapshot. */
  private projection(): SettingsState {
    return {
      ...this.form.shell(),
      apiKeyEnv: this.form.field('apiKeyEnv'),
      refreshSeconds: this.form.field('refreshIntervalMs'),
      timeoutSeconds: this.form.field('timeoutMs'),
      baseUrl: this.form.field('baseUrl'),
      apiKeyDraft: this.form.field(SECRET_FIELD),
      credentialConfigured: this.credential.configured,
      credentialWritable: this.credential.writable,
      legacyApiKey: this.dockStore.getSnapshot().snapshot?.legacyApiKey ?? false,
    }
  }

  /** Publish the settings projection and check whether the reference moved. */
  private publish(): void {
    const ref = this.ref()
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true }
      void this.readCredential()
    }
    this.settingsStore.set(this.projection())
  }

  /** The reference the form currently names, falling back to the provider default. */
  private ref(): string {
    const declared = this.form.field('apiKeyEnv').text.trim()
    return declared.length > 0 ? declared : DEFAULT_API_KEY_ENV
  }

  /** Ask the credentials domain about the current reference. */
  private async readCredential(): Promise<void> {
    const ref = this.ref()
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== this.ref()) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) {
      return
    }
    this.credential = next
    this.publish()
  }

  /** Write the staged credential to the reference the form names. */
  private async writeKey(value: string): Promise<boolean> {
    await this.ctx.remote.credentials.set(this.ref(), value)
    await this.readCredential()
    return this.credential.configured
  }

  /** Current refresh interval, clamped to the schema's documented minimum. */
  private intervalMs(): number {
    const value = this.scope.getSnapshot().value?.refreshIntervalMs
    return typeof value === 'number' && Number.isFinite(value) && value >= MIN_REFRESH_INTERVAL_MS
      ? value
      : DEFAULT_REFRESH_INTERVAL_MS
  }

  /** Stop the pending poll. */
  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }

  /** Arm the next poll from the current interval, or a short retry after a transport failure. */
  private reschedule(retry = false): void {
    this.stopTimer()
    if (this.disposed) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.refresh(false)
    }, retry ? 15_000 : this.intervalMs())
  }

  /** Fetch once; concurrent callers join the request in flight. */
  private async refresh(force: boolean): Promise<void> {
    if (this.disposed) return
    if (this.inflight !== undefined) {
      await this.inflight
      return
    }
    this.dockStore.set({ ...this.dockStore.getSnapshot(), loading: true, transportError: null })
    const run = (async () => {
      try {
        const result = await this.ctx.remote.ocgoUsage.snapshot(force)
        if (this.disposed) return
        if (result.ok) {
          this.dockStore.set({ snapshot: result.value, loading: false, transportError: null })
          this.publish()
        } else {
          this.dockStore.set({
            ...this.dockStore.getSnapshot(),
            loading: false,
            transportError: result.error.message,
          })
        }
      } catch (error) {
        if (this.disposed) return
        this.dockStore.set({
          ...this.dockStore.getSnapshot(),
          loading: false,
          transportError: error instanceof Error ? error.message : String(error),
        })
      } finally {
        this.inflight = undefined
        this.reschedule(this.dockStore.getSnapshot().transportError !== null)
      }
    })()
    this.inflight = run
    await run
  }
}
