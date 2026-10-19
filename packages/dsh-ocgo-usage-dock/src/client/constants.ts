/**
 * Client-visible copies of the defaults the Host schema owns.
 *
 * The browser half must not import `../constants.ts`: keeping `src/client`
 * self-contained lets its tsconfig emit a clean `lib/types/client/index.d.ts`
 * and keeps Host modules out of the bundle graph. Keep these values in sync
 * with `src/constants.ts`; the smoke test compares the schema defaults.
 */
export const DEFAULT_API_KEY_ENV = 'OPENCODE_GO_API_KEY'
export const DEFAULT_REFRESH_INTERVAL_MS = 300_000
export const MIN_REFRESH_INTERVAL_MS = 10_000
export const MIN_TIMEOUT_MS = 1_000
