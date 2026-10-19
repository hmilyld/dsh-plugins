# @hmilyld/dsh-ocgo-usage-dock

A DeepSeek Harness (DSH) web plugin that shows OpenCode Go's 5-hour, weekly, and monthly usage on a full-width row above the composer. The Host serves the data through a Typert Remote service; the API key lives in DSH credentials, never in the settings document.

```text
OpenCode Go usage   5-hour ▓▓▓░░ 29%   Weekly ▓▓▓▓░ 84%   Monthly ▓▓░░░ 46%   ⟳  ⚙
[composer]
```

- Hover a window to see its reset time.
- Health colors: < 60% green, 60–85% amber, ≥ 85% red.
- With no key the row renders nothing; endpoint failures show an error and a retry control without interrupting the conversation.
- Only OpenCode Go metadata is read; no model tokens are consumed.
- Settings save live: refresh interval, timeout, and endpoint are all editable.

## Requirements

- Node `^22.19.0 || >=24.0.0`
- DSH `>=0.2.0-rc.2 <0.3.0`
- pnpm `12.5.1` when building from source

## Install

From npm:

```bash
dsh plugin --profile web add @hmilyld/dsh-ocgo-usage-dock
```

From this monorepo:

```bash
pnpm install
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
dsh plugin --profile web add /absolute/path/to/DSHPlugins/packages/dsh-ocgo-usage-dock
```

Restart `dsh web` once after install. Remove with:

```bash
dsh plugin --profile web remove @hmilyld/dsh-ocgo-usage-dock
```

## Configure

Open **Plugins → @hmilyld/dsh-ocgo-usage-dock**.

| Field | Meaning |
| --- | --- |
| Credential reference | Environment/credential name that holds the key. Defaults to `OPENCODE_GO_API_KEY`; the Host re-resolves it on every request. |
| API key | Secret written to DSH credentials, never to the settings file. Leave blank to keep the current key. |
| Refresh interval (seconds) | Poll interval, minimum 10, default 300. |
| Request timeout (seconds) | Per-request limit, minimum 1, default 15. |
| Usage endpoint | Defaults to `https://opencode.ai/zen/go/v1/usage`. |

### Key precedence

The Host uses the first non-empty value:

1. the deprecated `apiKey` setting (kept for existing profiles);
2. `process.env[apiKeyEnv]`;
3. the historical `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY` names;
4. the value stored in DSH credentials for `apiKeyEnv`.

If the page shows the deprecation notice, the legacy setting still wins. Store the key in the **API key** field, save, then press **Clear deprecated key**.

## Troubleshooting

**401 from the usage endpoint**

OpenCode Go reports an expired or unauthorized key. Create a new key in the OpenCode Console, then store it in the **API key** field or update the referenced environment variable.

**The row does not appear**

- With no usable key this is intentional.
- Check that the plugin entry is running under **Plugins → Included components**.
- In DevTools, confirm `POST /api/ocgoUsage/snapshot` returns 200. A 404/500 usually means `lib/typert.host.js` was not published.

**Settings do not take effect**

Press **Save**. The Host invalidates its cache and the next request uses the new values; the dock itself may update on the next poll.

## Implementation

- **Host**: a default-exported `TypertRemoteService` provides `ocgoUsage/snapshot`. Pure logic in `src/usage.ts` handles config unwrapping, key resolution, response normalization, and error folding. The cache expires against the current interval and concurrent reads share one request.
- **Client**: `src/client/index.tsx` mounts `./remote`, then waits for `ctx.inject(['remote.ocgoUsage', ...])`. One controller owns the staged settings form, the credential badge, and the single polling loop. `UsageDock` registers on `conversation.input.dock`; `SettingsCard` registers on `plugins.bundle.config`.
- **Generation**: `@Remote` methods are emitted by the official Typert generator into `lib/typert.host.*` and `lib/typert.remote-client.*`; the client bundle includes the generated Remote and its zod schemas.

## Development

```bash
pnpm install
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run typecheck
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run build
pnpm --filter @hmilyld/dsh-ocgo-usage-dock run test
```

The package script chains Host `tsc` → Typert generation → Client `tsc` → esbuild bundle.

## License

MIT
