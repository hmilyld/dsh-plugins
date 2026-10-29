/** Dismissible notice shown above the composer of an imported session. */
import { useEffect, useState, type CSSProperties } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SESSION_ID_PREFIX } from './constants.ts'
import { NS, type LocaleKey } from './locales.ts'

export type ImportNoticeProps = PropsRuntime<'conversation.input.dock'> &
  PropsLocale<typeof NS>

/**
 * Explain the divergence once per imported conversation.
 *
 * The dock renders above the composer card as a stack sibling, so it inherits
 * neither the composer's side clearance nor its card max width. The frame
 * repeats both official variables to line the notice up with the card and the
 * rows above it.
 *
 * @param props - the bound session identity and the plugin dictionary.
 * @returns the notice, or null for ordinary sessions and after dismissal.
 */
export function ImportNotice(props: ImportNoticeProps) {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    setDismissed(false)
  }, [props.session.sessionId])
  const sessionId = props.session.sessionId
  if (dismissed || !sessionId.startsWith(SESSION_ID_PREFIX)) return null
  const t = props.t as (key: LocaleKey) => string
  return (
    <div style={styles.frame}>
      <div style={styles.notice} role="note">
        <div style={styles.body}>
          <div style={styles.title}>{t('noticeTitle')}</div>
          <div style={styles.text}>{t('noticeBody')}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          {t('noticeDismiss')}
        </Button>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  frame: {
    boxSizing: 'border-box',
    width: '100%',
    padding: '0 var(--dsh-composer-side-clearance)',
    display: 'flex',
    justifyContent: 'center',
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 'var(--dsh-composer-card-max-width)',
    padding: '4px 8px',
    borderRadius: 'var(--dsw-radius-md)',
    background: 'var(--dsw-alias-interactive-bg-hover)',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 },
  title: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-primary)',
  },
  text: {
    fontSize: 12,
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-secondary)',
  },
}
