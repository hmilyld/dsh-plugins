/**
 * Plugin configuration.
 *
 * Every field is `.volatile()`: the Loader hot-writes changed values without
 * restarting the plugin, and the settings mirror exposes the schema to the
 * browser half. Runtime values therefore arrive as `Volatile<T>` wrappers;
 * `readConfig` unwraps them at each use so a saved edit takes effect on the
 * next request.
 *
 * `apiKey` is the pre-credential field kept for existing profiles. New
 * configuration belongs in `apiKeyEnv`, a credential reference resolved
 * through `ctx.credentials`; the secret literal never rides a settings
 * response once stored there.
 */
import Schema from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'
import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_BASE_URL,
  DEFAULT_REFRESH_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  MIN_REFRESH_INTERVAL_MS,
  MIN_TIMEOUT_MS,
} from './constants.ts'

/** Runtime configuration shape. */
export interface Config {
  /** Deprecated secret literal; prefer `apiKeyEnv`. */
  apiKey: Volatile<string>
  /** Credential reference naming the environment-backed key. */
  apiKeyEnv: Volatile<string>
  /** Automatic refresh interval in milliseconds. */
  refreshIntervalMs: Volatile<number>
  /** Per-request timeout in milliseconds. */
  timeoutMs: Volatile<number>
  /** Usage endpoint. */
  baseUrl: Volatile<string>
}

/** Schemastery schema for the plugin entry. */
export const Config = Schema.object({
  apiKey: Schema.string()
    .role('secret')
    .default('')
    .description('Deprecated: use apiKeyEnv and store the key through the credentials field.')
    .volatile(),
  apiKeyEnv: Schema.string()
    .default(DEFAULT_API_KEY_ENV)
    .description('Credential reference such as OPENCODE_GO_API_KEY.')
    .volatile(),
  refreshIntervalMs: Schema.natural()
    .min(MIN_REFRESH_INTERVAL_MS)
    .default(DEFAULT_REFRESH_INTERVAL_MS)
    .description('Automatic refresh interval in milliseconds.')
    .volatile(),
  timeoutMs: Schema.natural()
    .min(MIN_TIMEOUT_MS)
    .default(DEFAULT_TIMEOUT_MS)
    .description('Per-request timeout in milliseconds.')
    .volatile(),
  baseUrl: Schema.string()
    .default(DEFAULT_BASE_URL)
    .description('Usage endpoint URL.')
    .volatile(),
})
