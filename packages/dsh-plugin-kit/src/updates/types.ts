/** What an update check reports to the settings UI. */
export interface UpdateStatus {
  /** Package whose registry entry was checked. */
  packageName: string
  /** Version this plugin build is running. */
  currentVersion: string
  /** `latest` dist-tag version, or null before the first successful check. */
  latestVersion: string | null
  /** Whether `latestVersion` is strictly newer than `currentVersion`. */
  updateAvailable: boolean
  /** Epoch milliseconds of the last successful check. */
  checkedAt: number | null
  /** Last transport or response error; never thrown to the caller. */
  error: string | null
}

/** Read-only observable snapshot of update status. */
export interface UpdateStore {
  getSnapshot(): UpdateStatus
  subscribe(listener: () => void): () => void
  /**
   * Refresh from the registry, reusing a fresh cache.
   * @param force - ignore the cache TTL.
   */
  refresh(force?: boolean): Promise<void>
}

/** Copy rendered by the shared update notice. */
export interface UpdateNoticeLabels {
  /** Template with `{latest}` and `{current}` placeholders. */
  available: string
  /** Link copy for the changelog. */
  changelog: string
}
