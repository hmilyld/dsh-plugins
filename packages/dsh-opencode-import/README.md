# @hmilyld/dsh-opencode-import

English | [中文](README.zh.md)

A DeepSeek Harness (DSH) plugin that imports the OpenCode conversations of a workspace into the DSH workspace session list as **real, openable DSH sessions**. Each imported session is a normal DSH session log: it appears in the sidebar under its workspace, opens the normal conversation view, is searchable, and can be continued.

```text
workspace: ~/Codespace/my-app
  ├─ session-…            (a normal DSH session)
  ├─ session-oc-9f2c…     ◂ imported from OpenCode
  └─ session-oc-31ab…     ◂ imported from OpenCode
```

The Host half reads OpenCode's SQLite store read-only, maps each conversation into DSH session events, writes a real session log, warms the projection cache so the sidebar row shows the OpenCode title, and attaches the session to the matching workspace. The browser half renders the settings page, a read-only preview, a sidebar badge, and a one-time divergence notice.

## Identifiers

| Kind | Value |
| --- | --- |
| Package | `@hmilyld/dsh-opencode-import` |
| Loader entry id / settings namespace | `opencode-import` |
| Bundle config key | `@hmilyld/dsh-opencode-import` |
| Host short name | `opencode-import` |
| Remote namespace | `opencodeImport` |
| DSH session id prefix | `session-oc-` |

## Requirements

- Node `^22.19.0 || >=24.0.0` (`node:sqlite` is used read-only)
- DSH `>=0.2.0-rc.2 <0.3.0`
- OpenCode with the current SQLite schema (`session_v2` + `session_message`)

## Install

```bash
dsh plugin --profile web add @hmilyld/dsh-opencode-import
```

From source (build first):

```bash
pnpm --filter @hmilyld/dsh-opencode-import run build
dsh plugin --profile web add /absolute/path/to/DSHPlugins/packages/dsh-opencode-import
```

Restart `dsh web` once after installing.

## When it runs

- Shortly after the plugin loads, when **Scan at startup** is on.
- When the workspace registry gains or changes a workspace, when **Scan when a workspace is added** is on (debounced).
- Whenever **Scan now** is pressed on the settings page.

All three share one in-flight pass: concurrent triggers never write twice.

## What gets imported

- Root OpenCode sessions (`parent_id` empty) that are not archived.
- Only sessions whose recorded `directory` canonicalizes to a registered DSH workspace path. Other directories are reported as unmatched and left alone.
- The newest N conversation messages when **Messages per session** is set; `0` imports everything.
- User text, assistant text, reasoning (optional), tool calls and their results (optional), token usage, and the OpenCode title.
- User attachments become a `[附件: name]` text block; binaries are never copied.

Skipped by design: child sessions, archived sessions, `synthetic` / `system` / `compaction` / `idle` rows, and sessions that map to no conversation at all.

## How an import is written

1. A deterministic DSH session id is derived from the OpenCode session id (`session-oc-<sha256[:24]>`), so a second pass recognizes an existing import with a header-only `stat` and skips it.
2. The conversation is mapped to `turn/start` → `step/start` → `user/message` / `assistant/message` / `tool/call` / `tool/result` → `step/end` → `turn/end`, followed by a pinned `session/title` event carrying the OpenCode title.
3. The events are written as one append batch to the DSH session log with the workspace path as `cwd`.
4. The projection cache is warmed from the same events, so the list row shows the title and the last-prompt recency before the session is ever opened.
5. `workspace.attachSession()` prepends the session to the workspace's account, newest first.

If any step fails, the failure is contained to that one session and reported; the rest of the pass continues.

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `dbPath` | empty | `opencode.db` path; empty probes `$XDG_DATA_HOME/opencode/opencode.db` (`%LOCALAPPDATA%\opencode\opencode.db` on Windows) |
| `autoScanOnStart` | `true` | Run one pass after the plugin loads |
| `scanOnWorkspaceCreate` | `true` | Rescan when the workspace registry changes |
| `includeToolCalls` | `true` | Import tool calls and results |
| `includeReasoning` | `true` | Import assistant reasoning blocks |
| `maxMessagesPerSession` | `0` | Keep the newest N conversation messages; `0` keeps all |
| `excludedDirectories` | `[]` | Absolute directories whose sessions are never imported |

## Limitations

- **One-way snapshot.** The import runs once per OpenCode session; later OpenCode messages do not flow into the DSH copy.
- **Continuing diverges.** An imported session is a real DSH session, so it can be continued. New turns stay in DSH and OpenCode never sees them; the conversation view shows a dismissible notice saying so.
- **Session format coupling.** The plugin stamps the format version observed from the running store and maps onto the current DSH event vocabulary. A DSH release that changes that vocabulary requires a plugin update; a mismatch fails per session and is reported, never silently corrupting a log.
- **OpenCode schema coupling.** Only the current `session_v2` schema is read. An older store reports `unsupported` instead of guessing.
- **Imported sessions are real sessions.** They count as workspace sessions for DSH features such as search and stats, and they cannot be made read-only.

## Development

```bash
pnpm install
pnpm --filter @hmilyld/dsh-opencode-import run build
pnpm --filter @hmilyld/dsh-opencode-import run test
pnpm run check
```

The mapping is a pure function covered by tests that validate its events against the real `Session` store; `tests/importer.spec.ts` covers planning, idempotency, and failure containment; `tests/client.spec.ts` covers the ModuleLoader bundle contract.

## License

MIT
