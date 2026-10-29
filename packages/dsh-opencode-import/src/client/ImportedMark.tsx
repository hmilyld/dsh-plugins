/** Leading mark shown on a session row this plugin imported. */
import type { CSSProperties } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SESSION_ID_PREFIX } from './constants.ts'
import { NS, type LocaleKey } from './locales.ts'

export type ImportedMarkProps = PropsRuntime<'sidebar.session.row.leading'> &
  PropsLocale<typeof NS>

/**
 * Render the OpenCode badge for imported rows only.
 *
 * @param props - the row's session identity and the card's dictionary.
 * @returns the 16px cell content, or null for ordinary sessions.
 */
export function ImportedMark(props: ImportedMarkProps) {
  if (typeof props.sessionId !== 'string' || !props.sessionId.startsWith(SESSION_ID_PREFIX)) {
    return null
  }
  const t = props.t as (key: LocaleKey) => string
  const label = t('importedBadge')
  return (
    <span style={styles.cell} role="img" aria-label={label} title={label}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 3.5h11v7.2H8.1L5 13.2v-2.5H2.5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M5.2 6.3h5.6M5.2 8.3h3.6" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </span>
  )
}

const styles: Record<string, CSSProperties> = {
  cell: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    color: 'var(--dsw-alias-label-tertiary)',
  },
}
