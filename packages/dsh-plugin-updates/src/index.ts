/**
 * Update detection shared by every `@hmilyld` DSH plugin.
 *
 * The browser half asks the npm registry for the package's `latest` dist-tag,
 * compares it with the version the bundle was built from, and remembers the
 * answer for a few hours. A plugin renders {@link UpdateNotice} on its settings
 * page so a newer release and its changelog are one click away.
 */
export { compareVersions, isNewerVersion, parseVersion } from './version.ts'
export type { ParsedVersion } from './version.ts'
export { createUpdateStore } from './store.ts'
export type { UpdateStoreOptions } from './store.ts'
export { UpdateNotice } from './UpdateNotice.tsx'
export type { UpdateNoticeProps } from './UpdateNotice.tsx'
export type { UpdateNoticeLabels, UpdateStatus, UpdateStore } from './types.ts'
