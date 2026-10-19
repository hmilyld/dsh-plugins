/** One-line update banner shared by every plugin settings page. */
import type { CSSProperties } from 'react'
import type { UpdateNoticeLabels, UpdateStatus } from './types.ts'

/** Props for {@link UpdateNotice}. */
export interface UpdateNoticeProps {
  /** Current state from the plugin's update store. */
  state: UpdateStatus
  /** Changelog address the link opens. */
  changelogUrl: string
  /** Localized copy. */
  labels: UpdateNoticeLabels
}

/**
 * Render the update banner, or nothing when the build is current.
 * @param props - state, link, and copy.
 * @returns the banner or null.
 */
export function UpdateNotice({ state, changelogUrl, labels }: UpdateNoticeProps) {
  if (!state.updateAvailable || state.latestVersion === null) return null
  const message = labels.available
    .replaceAll('{latest}', state.latestVersion)
    .replaceAll('{current}', state.currentVersion)
  return (
    <div style={styles.notice} role="status">
      <span style={styles.text}>{message}</span>
      <a href={changelogUrl} target="_blank" rel="noreferrer" style={styles.link}>
        {labels.changelog}
      </a>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  notice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--dsw-alias-state-success-border, #22c55e)',
    background: 'var(--dsw-alias-state-success-bg, rgba(34, 197, 94, 0.08))',
    color: 'var(--dsw-alias-label-secondary, #6b7280)',
    fontSize: 12,
    lineHeight: '18px',
  },
  text: {
    color: 'var(--dsw-alias-label-primary, #111827)',
  },
  link: {
    color: 'var(--dsw-alias-label-primary, #111827)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
}
