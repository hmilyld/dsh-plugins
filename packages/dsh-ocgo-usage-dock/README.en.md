# @hmilyld/dsh-ocgo-usage-dock

A DSH (DeepSeek Harness) **Web plugin** that shows OpenCode Go usage on its own row below the conversation composer (5-hour rolling window / weekly window / monthly window) with a settings page. Built against **DSH 0.2.0-rc.2**.

```text
[DSH built-in token meter row] (stays in place)
OpenCode Go  ● 5h 29%  ● weekly 94%  ● monthly 69%        [⟳] [⚙]
```

- Every window shows the **used percentage** by default; hovering shows a tooltip with the **reset time** (absolute + remaining), so you can pace your usage.
- Health dot: < 60% green, 60–85% yellow, ≥ 85% red.
- Data comes from OpenCode's official usage endpoint (pure metadata); it never consumes model tokens.
- With no API key configured, nothing renders below the composer (silent by design).
- ⟳ pierces the 5-minute cache; ⚙ opens the settings panel at the plugin page.

## Install

Requires Node ≥ 20 and DSH 0.2.0-rc.2 (`dsh --version`).

```bash
# 1. Clone anywhere (eg: ~/Codespace)
git clone https://github.com/hmilyld/dsh-ocgo-usage-dock.git
cd dsh-ocgo-usage-dock

# 2. Install deps (mandatory the first time; local-path installs resolve imports from this directory)
npm install

# 3. Install into the web profile
dsh plugin --profile web add "$(pwd)"

# 4. Verify the composed profile (does not boot the app)
dsh --profile web --dump-config | grep -A8 ocgo-usage-dock

# 5. Start / restart dsh web; the usage dock appears below the composer
dsh web
```

Upgrading: disable/uninstall the old version at the plugin page first (or `dsh plugin --profile web remove @hmilyld/dsh-ocgo-usage-dock`), then repeat steps 2–3 and restart `dsh web`.

**Clean reinstall after a rename/repo move**: stale rows with an old package name are not self-healed by re-installing — remove the old dependency key and bundles row from `~/.dsh/profiles/web/package.json` by hand, then reinstall (symptom: duplicate loader entry in the boot log).

## Configuration

| Field | Default | Description |
| --- | --- | --- |
| API Key | (empty) | OpenCode Go API key; empty falls back to the resolution chain below |
| Refresh interval (seconds) | `300` | Polling interval; edited as seconds, minimum 10s |
| Request timeout (seconds) | `15` | Per-request timeout; minimum 1s |
| Endpoint URL | `https://opencode.ai/zen/go/v1/usage` | Usage endpoint (normally unchanged) |

All fields are editable live in the plugin settings page; saving applies immediately (no restart).

### API key resolution order

Tried in order, first hit wins:

1. The key set in the plugin settings;
2. Env `OPENCODE_GO_API_KEY`;
3. Env `OPENCODE_API_KEY`;
4. The `OPENCODE_GO_API_KEY` entry in the DSH credential store `$DSH_HOME/.credentials.yaml`.

The key value is **never echoed back** on any page or API response (write-only).

### Getting a key

1. Sign in to the OpenCode web console;
2. Create a key on the **API Keys / Settings** page;
3. Paste it into the plugin settings page (recommended), or export it before launching dsh:

```bash
export OPENCODE_GO_API_KEY='your key'
dsh web
```

## Settings usage

**Single entry point**: sidebar **Plugins** → open the **OpenCode Go Usage** card → the form on that page.

1. Edit the fields (the API key is a password input; interval/timeout are in seconds);
2. Click **Save** (shows “保存中…” briefly);
3. Success applies immediately: the host rebuilds the polling timer, clears the cache, and fetches once — **no `dsh web` restart needed**;
4. Invalid input (refresh < 10s, timeout < 1s, empty URL) is blocked with an inline error and not saved.

### Using the dock

- **⟳**: instant refresh (bypasses the 5-minute server cache); shows `…` and is disabled while loading;
- **⚙**: opens the settings panel and lands on the plugin page.

## Troubleshooting

- **Dock never shows** → no resolvable key; set one in the plugin settings and hit ⟳. Full-chain missing key stays silent by design.
- **Error row** → only real failures (timeout / network / non-2xx) show one error line + retry. Check the endpoint URL and, for proxied networks, export `HTTPS_PROXY` before starting dsh (the request is sent from the dsh process, not the browser).
- **Gear does nothing / not landing on the plugin page** → another modal may be open or the sidebar is collapsed; click “插件 / Plugins” in the navigation manually.
- **Boot log says `entry did not activate ... failed to import`** → run `npm install` in the package directory first (imports resolve from there on local installs), then restart `dsh web`.
- **After disabling** → the dock and timers are cleared while settings persist; re-enabling restores everything.

## Data notes

- Usage data is fetched from OpenCode and cached for 5 minutes; no local data is collected or sent anywhere;
- The API key lives only in the host process and your profile files — the browser can never see it;
- Requests need a browser-like User-Agent (handled automatically; the endpoint rejects non-browser clients).

## License

MIT — see [LICENSE](./LICENSE).
