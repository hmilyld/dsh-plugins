/** Defaults shared by the Host configuration schema and the browser form. */

/** Credential reference used when `apiKeyEnv` is left blank. */
export const DEFAULT_API_KEY_ENV = 'OPENCODE_GO_API_KEY'

/** Metadata endpoint used by the OpenCode Go dashboard. */
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1/usage'

/** Default automatic refresh interval (five minutes). */
export const DEFAULT_REFRESH_INTERVAL_MS = 300_000

/** Smallest interval the settings form accepts (ten seconds). */
export const MIN_REFRESH_INTERVAL_MS = 10_000

/** Default per-request timeout. */
export const DEFAULT_TIMEOUT_MS = 15_000

/** Smallest timeout the settings form accepts (one second). */
export const MIN_TIMEOUT_MS = 1_000
