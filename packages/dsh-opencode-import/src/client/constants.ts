/** Browser-side identifiers shared by the settings card and row decoration. */

/** Loader entry id; also the settings namespace the Host serves. */
export const ENTRY_ID = 'opencode-import'

/** Bundle package name keyed by the Plugins page's bundle card. */
export const BUNDLE_KEY = '@hmilyld/dsh-opencode-import'

/**
 * Prefix of every DSH session id this plugin mints.
 *
 * The Host mints these ids deterministically, so the browser can recognize an
 * imported row without a round trip.
 */
export const SESSION_ID_PREFIX = 'session-oc-'
