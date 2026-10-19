/** Full-width usage row above the composer. */
import type { CSSProperties } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageSnapshot, UsageWindow } from '@hmilyld/dsh-ocgo-usage-dock/types'
import type { DockFace } from './controller.ts'
import type { OcgoLocaleKey } from './locales.ts'
import { NS } from './locales.ts'

/** Props the dock slot hands the component. */
export type UsageDockProps = PropsRuntime<'conversation.input.dock'> &
  PropsLocale<typeof NS> &
  InjectFace<DockFace>

/** Health colour for one window. */
function healthColor(percent: number | null): string {
  if (percent === null) return 'var(--dsw-alias-label-tertiary, #9ca3af)'
  if (percent >= 85) return 'var(--dsw-alias-state-error-primary, #ef4444)'
  if (percent >= 60) return 'var(--dsw-alias-state-warning-primary, #f59e0b)'
  return 'var(--dsw-alias-state-success-primary, #22c55e)'
}

/** Human reset copy for one window. */
function resetText(
  window: UsageWindow,
  t: (key: OcgoLocaleKey) => string,
): string | undefined {
  if (window.resetsAt !== undefined) {
    const date = new Date(window.resetsAt)
    if (!Number.isNaN(date.getTime())) return `${t('resetAt')} ${date.toLocaleString()}`
  }
  if (window.resetInSec !== undefined && window.resetInSec >= 0) {
    const seconds = Math.round(window.resetInSec)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.max(1, Math.round((seconds % 3600) / 60))
    return `${t('resetIn')} ${hours > 0 ? `${hours}h ` : ''}${minutes}m`
  }
  return undefined
}

/** Localized copy for a Host error code. */
function errorText(code: string | undefined, t: (key: OcgoLocaleKey) => string): string {
  if (code === 'timeout') return t('errorTimeout')
  if (code === 'network') return t('errorNetwork')
  if (code !== undefined && code.startsWith('http-')) return `${t('errorHttp')} (${code.slice(5)}).`
  return t('errorNetwork')
}

/** One window bar. */
function WindowBar({
  window,
  label,
  t,
}: {
  window: UsageWindow
  label: string
  t: (key: OcgoLocaleKey) => string
}) {
  const percent = window.percent
  const width = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  const color = healthColor(percent)
  const reset = resetText(window, t)
  return (
    <span style={styles.window} title={reset}>
      <span style={styles.windowLabel}>{label}</span>
      <span style={styles.track}>
        <span style={{ ...styles.fill, width: `${width}%`, background: color }} />
      </span>
      <span style={{ ...styles.percent, color }}>
        {percent === null ? '—' : `${Math.round(percent)}%`}
      </span>
    </span>
  )
}

/** Small icon button. */
function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{ ...styles.iconButton, opacity: disabled === true ? 0.5 : 1 }}
    >
      {children}
    </button>
  )
}

/**
 * Render the usage row.
 * @param props - slot runtime props, the locale reader, and the controller face.
 * @returns the dock, or null while it has nothing useful to say.
 */
export function UsageDock(props: UsageDockProps) {
  const state = props.useUsageDock((value) => value)
  const update = props.useUpdate((value) => value)
  const t = props.t as (key: OcgoLocaleKey) => string
  const snapshot: UsageSnapshot | null = state.snapshot

  if (snapshot === null && state.transportError === null) return null
  if (snapshot !== null && snapshot.status === 'no-key') return null

  const failed = snapshot === null || snapshot.status === 'error' || state.transportError !== null
  return (
    <div style={styles.dock} role="status" aria-label={t('dockLabel')}>
      <span style={styles.brand}>{t('title')}</span>
      {failed ? (
        <>
          <span style={styles.error}>
            {state.transportError !== null
              ? t('errorNetwork')
              : errorText(snapshot?.error, t)}
          </span>
          <span style={styles.spacer} />
          <IconButton label={t('retry')} disabled={state.loading} onClick={props.refresh}>
            ⟳
          </IconButton>
        </>
      ) : (
        <>
          <WindowBar window={snapshot?.windows[0] ?? fallback('rolling')} label={t('windowRolling')} t={t} />
          <WindowBar window={snapshot?.windows[1] ?? fallback('weekly')} label={t('windowWeekly')} t={t} />
          <WindowBar window={snapshot?.windows[2] ?? fallback('monthly')} label={t('windowMonthly')} t={t} />
          <span style={styles.spacer} />
          <IconButton
            label={state.loading ? t('refreshing') : t('refresh')}
            disabled={state.loading}
            onClick={props.refresh}
          >
            ⟳
          </IconButton>
        </>
      )}
      <span style={styles.gearWrap}>
        <IconButton
          label={update.updateAvailable ? t('updateChangelog') : t('openSettings')}
          onClick={props.openSettings}
        >
          ⚙
        </IconButton>
        {update.updateAvailable ? <span style={styles.updateDot} aria-hidden="true" /> : null}
      </span>
    </div>
  )
}

/** Placeholder window when the Host answer omitted one. */
function fallback(id: string): UsageWindow {
  return { id, percent: null, status: 'unknown' }
}

const styles: Record<string, CSSProperties> = {
  dock: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    rowGap: 2,
    width: '100%',
    padding: '2px 2px 4px',
    color: 'var(--dsw-alias-label-secondary, #6b7280)',
    fontSize: 12,
    lineHeight: '18px',
    minWidth: 0,
  },
  brand: {
    color: 'var(--dsw-alias-label-primary, #111827)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  window: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    whiteSpace: 'nowrap',
  },
  windowLabel: {
    color: 'var(--dsw-alias-label-tertiary, #9ca3af)',
  },
  track: {
    display: 'inline-block',
    width: 42,
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'var(--dsw-alias-border-l2, #e5e7eb)',
  },
  fill: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
    transition: 'width 240ms ease',
  },
  percent: {
    fontVariantNumeric: 'tabular-nums',
    minWidth: 34,
    textAlign: 'right',
  },
  spacer: {
    flex: 1,
  },
  error: {
    color: 'var(--dsw-alias-state-error-primary, #ef4444)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  iconButton: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary, #6b7280)',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: 14,
    lineHeight: '18px',
    borderRadius: 6,
  },
  gearWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  updateDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--dsw-alias-state-success-primary, #22c55e)',
  },
}
