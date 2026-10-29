/**
 * Browser-side controller for the settings card.
 *
 * One controller per Client plugin owns the staged settings form, the last Host
 * status, the read-only preview, and the single scan action. Slot components
 * only read stores through their injected face.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ImportStatus, PreviewRow } from '@hmilyld/dsh-opencode-import/types'
import type {} from '@hmilyld/dsh-opencode-import/remote'
import {
  createStore,
  createUpdateStore,
  SettingsFormModel,
  settingsBooleanField,
  settingsTextField,
  type SettingsFieldSpec,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
  type SettingsFormShell,
  type Store,
  type UpdateStore,
  type WritableStore,
} from '@hmilyld/dsh-plugin-kit'
import { BUNDLE_KEY, ENTRY_ID } from './constants.ts'

/** What the browser sees of one Host settings section value. */
export interface PluginConfig {
  dbPath?: string
  autoScanOnStart?: boolean
  scanOnWorkspaceCreate?: boolean
  includeToolCalls?: boolean
  includeReasoning?: boolean
  maxMessagesPerSession?: number
  excludedDirectories?: string[]
}

/** What the settings card renders. */
export interface SettingsState extends SettingsFormShell {
  dbPath: SettingsFieldState
  autoScanOnStart: SettingsFieldState
  scanOnWorkspaceCreate: SettingsFieldState
  includeToolCalls: SettingsFieldState
  includeReasoning: SettingsFieldState
  maxMessagesPerSession: SettingsFieldState
  excludedDirectories: SettingsFieldState
  status: ImportStatus | null
  scanning: boolean
  scanError: string | null
}

/** Read-only preview state. */
export interface PreviewState {
  loading: boolean
  rows: PreviewRow[]
  unmatchedDirectories: string[]
  truncated: boolean
  error: string | null
}

/** Minimal observable face of the Client Workspace model. */
interface WorkspaceModelLike {
  subscribe(listener: () => void): () => void
  getSnapshot(): { items: readonly unknown[] }
}

/** Minimal face of the Client Session manager used to refresh the list. */
interface SessionListLike {
  refresh?(): Promise<void>
}

/** The settings card's injected face. */
export interface Face extends SettingsFormActions {
  hooks: {
    settings: Store<SettingsState>
    preview: Store<PreviewState>
    update: UpdateStore
  }
  scan: () => void
  refreshPreview: () => void
}

/** Message text of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Whole-number field for the per-session message cap. */
const maxMessagesSpec: SettingsFieldSpec = {
  field: 'maxMessagesPerSession',
  format: (value) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : ''),
  parse: (text) => {
    if (text.trim() === '') return { kind: 'clear' }
    const parsed = Number(text)
    return Number.isInteger(parsed) && parsed >= 0 ? { kind: 'set', value: parsed } : undefined
  },
}

/** One path per line, stored as a string array. */
const excludedDirectoriesSpec: SettingsFieldSpec = {
  field: 'excludedDirectories',
  format: (value) =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string').join('\n')
      : '',
  parse: (text) => ({
    kind: 'set',
    value: text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  }),
}

/** Bridges the Host settings scope and Remote onto the card. */
export class ImportClientController {
  private readonly form: SettingsFormModel<PluginConfig>
  private readonly settingsStore: WritableStore<SettingsState>
  private readonly previewStore = createStore<PreviewState>({
    loading: false,
    rows: [],
    unmatchedDirectories: [],
    truncated: false,
    error: null,
  })
  private readonly updateStore = createUpdateStore({
    packageName: BUNDLE_KEY,
    currentVersion: __PKG_VERSION__,
  })
  private readonly unsubscribers: (() => void)[] = []
  private status: ImportStatus | null = null
  private scanning = false
  private scanError: string | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | undefined
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private workspaceUnsubscribe: (() => void) | undefined
  private importedBaseline: number | undefined
  private disposed = false

  /**
   * @param ctx - the Client plugin context, mounted Remote included.
   */
  constructor(private readonly ctx: ClientContext) {
    const scope: SettingsFormScope<PluginConfig> = ctx.configForms.get<PluginConfig>(ENTRY_ID)
    this.form = new SettingsFormModel<PluginConfig>(scope, [
      settingsTextField('dbPath'),
      settingsBooleanField('autoScanOnStart'),
      settingsBooleanField('scanOnWorkspaceCreate'),
      settingsBooleanField('includeToolCalls'),
      settingsBooleanField('includeReasoning'),
      maxMessagesSpec,
      excludedDirectoriesSpec,
    ])
    this.settingsStore = createStore(this.projection())
    const formStore = this.form.bind(() => this.form.shell())
    this.unsubscribers.push(formStore.subscribe(() => this.publish()))

    void this.updateStore.refresh(false)
    void this.refreshStatus()
    void this.refreshPreview()
    this.watchWorkspaceAdditions()
    this.startImportedPoll()
  }

  /** The settings card's injected face. */
  face(): Face {
    return {
      hooks: {
        settings: this.settingsStore,
        preview: this.previewStore,
        update: this.updateStore,
      },
      ...this.form.actions(),
      scan: () => {
        void this.scan()
      },
      refreshPreview: () => {
        void this.refreshPreview()
      },
    }
  }

  /** Release subscriptions, timers, and the form scope. */
  dispose(): void {
    this.disposed = true
    this.clearRefreshTimer()
    if (this.pollTimer !== undefined) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
    this.workspaceUnsubscribe?.()
    this.workspaceUnsubscribe = undefined
    for (const off of this.unsubscribers.splice(0)) off()
    this.form.dispose()
  }

  /**
   * Watch the Client Workspace model for additions.
   *
   * A newly registered workspace makes the Host import and attach its
   * sessions asynchronously; the Client session catalog is a snapshot, so
   * without a refresh the new rows only appear after a page reload.
   */
  private watchWorkspaceAdditions(): void {
    const service = (this.ctx as unknown as { get(name: string): unknown }).get('workspaces') as
      | { model?: WorkspaceModelLike }
      | undefined
    const model = service?.model
    if (model === undefined) return
    let known = model.getSnapshot().items.length
    // The first notification may be the follow baseline, not a user addition.
    let baseline = known > 0
    this.workspaceUnsubscribe = model.subscribe(() => {
      const next = model.getSnapshot().items.length
      if (!baseline) {
        baseline = true
        known = next
        return
      }
      if (next <= known) {
        known = next
        return
      }
      known = next
      this.scheduleSessionListRefresh()
    })
  }

  /**
   * Slow safety net: the imported count is the one Host value that changes for
   * every import gesture (startup, workspace add, manual scan).
   */
  private startImportedPoll(): void {
    this.pollTimer = setInterval(() => {
      void this.checkImportedCount()
    }, 5_000)
  }

  /** Refresh the catalog when the Host reports more imported sessions. */
  private async checkImportedCount(): Promise<void> {
    if (this.disposed) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    try {
      const result = await this.ctx.remote.opencodeImport.status()
      if (this.disposed || !result.ok) return
      const next = result.value.importedSessions
      if (this.importedBaseline === undefined) {
        this.importedBaseline = next
        return
      }
      if (next === this.importedBaseline) return
      this.importedBaseline = next
      this.status = result.value
      this.publish()
      await this.refreshSessionList()
    } catch {
      // A transient transport failure retries on the next tick.
    }
  }

  /** Give the debounced Host scan time to finish before pulling the list. */
  private scheduleSessionListRefresh(): void {
    if (this.disposed) return
    this.clearRefreshTimer()
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined
      void this.refreshSessionListWhenIdle()
    }, 2_500)
  }

  /** Poll the Host until the scan is idle, then refresh the session catalog. */
  private async refreshSessionListWhenIdle(): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (this.disposed) return
      try {
        const result = await this.ctx.remote.opencodeImport.status()
        if (this.disposed) return
        if (result.ok && !result.value.scanning) {
          this.status = result.value
          this.publish()
          await this.refreshSessionList()
          return
        }
      } catch {
        // A transient transport failure retries on the next attempt.
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 1_000))
    }
  }

  /** Re-pull the Client session catalog so new rows render. */
  private async refreshSessionList(): Promise<void> {
    const sessions = (this.ctx as unknown as { sessions?: SessionListLike }).sessions
    await sessions?.refresh?.()
  }

  /** Stop the pending debounced refresh. */
  private clearRefreshTimer(): void {
    if (this.refreshTimer === undefined) return
    clearTimeout(this.refreshTimer)
    this.refreshTimer = undefined
  }

  /** Run one import pass and refresh the status and preview afterwards. */
  private async scan(): Promise<void> {
    if (this.scanning || this.disposed) return
    this.scanning = true
    this.scanError = null
    this.publish()
    try {
      const result = await this.ctx.remote.opencodeImport.scan()
      if (!result.ok) {
        this.scanError = result.error.message
      } else if (result.value.imported > 0) {
        await this.refreshSessionList()
      }
    } catch (error) {
      this.scanError = messageOf(error)
    } finally {
      this.scanning = false
      await this.refreshStatus()
      await this.refreshPreview()
    }
  }

  /** Read the Host status without running a scan. */
  private async refreshStatus(): Promise<void> {
    try {
      const result = await this.ctx.remote.opencodeImport.status()
      if (this.disposed) return
      if (result.ok) {
        this.status = result.value
        if (this.importedBaseline === undefined) {
          this.importedBaseline = result.value.importedSessions
        }
      } else {
        this.scanError = result.error.message
      }
    } catch (error) {
      this.scanError = messageOf(error)
    }
    this.publish()
  }

  /** Read the read-only preview. */
  private async refreshPreview(): Promise<void> {
    this.previewStore.set({ ...this.previewStore.getSnapshot(), loading: true, error: null })
    try {
      const result = await this.ctx.remote.opencodeImport.preview()
      if (this.disposed) return
      if (result.ok) {
        this.previewStore.set({
          loading: false,
          rows: result.value.rows,
          unmatchedDirectories: result.value.unmatchedDirectories,
          truncated: result.value.truncated,
          error: null,
        })
      } else {
        this.previewStore.set({
          loading: false,
          rows: [],
          unmatchedDirectories: [],
          truncated: false,
          error: result.error.message,
        })
      }
    } catch (error) {
      this.previewStore.set({
        loading: false,
        rows: [],
        unmatchedDirectories: [],
        truncated: false,
        error: messageOf(error),
      })
    }
  }

  /** Build the settings projection from the form, status, and scan state. */
  private projection(): SettingsState {
    return {
      ...this.form.shell(),
      dbPath: this.form.field('dbPath'),
      autoScanOnStart: this.form.field('autoScanOnStart'),
      scanOnWorkspaceCreate: this.form.field('scanOnWorkspaceCreate'),
      includeToolCalls: this.form.field('includeToolCalls'),
      includeReasoning: this.form.field('includeReasoning'),
      maxMessagesPerSession: this.form.field('maxMessagesPerSession'),
      excludedDirectories: this.form.field('excludedDirectories'),
      status: this.status,
      scanning: this.scanning,
      scanError: this.scanError,
    }
  }

  /** Publish the current projection. */
  private publish(): void {
    if (this.disposed) return
    this.settingsStore.set(this.projection())
  }
}
