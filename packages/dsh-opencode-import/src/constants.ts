/** Loader entry id, settings namespace, and wire-visible constants. */

/** Loader entry id; also the settings namespace this plugin serves. */
export const ENTRY_ID = 'opencode-import'

/** Bundle package name keyed by the Plugins page's bundle card. */
export const PACKAGE_NAME = '@hmilyld/dsh-opencode-import'

/**
 * Prefix of every DSH session id this plugin mints.
 *
 * The browser half uses it to decorate imported rows without a round trip, so
 * changing the scheme is a breaking UI change, not only a storage detail.
 */
export const SESSION_ID_PREFIX = 'session-oc-'

/** Delay before the startup scan so the first composition settles first. */
export const STARTUP_SCAN_DELAY_MS = 2_000

/** Debounce for workspace-registry changes. */
export const WORKSPACE_SCAN_DEBOUNCE_MS = 1_500

/** Upper bound on per-scan error strings kept in the report. */
export const MAX_REPORT_ERRORS = 20

/** Upper bound on preview rows returned to the settings card. */
export const PREVIEW_LIMIT = 200

/** Longest title accepted from OpenCode before truncation. */
export const MAX_TITLE_CHARS = 200
