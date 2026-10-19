/** Boolean row: label, switch, hint, and override reset. */
import type { CSSProperties } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'

/** Props for {@link SettingsToggleField}. */
export interface SettingsToggleFieldProps {
  /** Stable control id. */
  id: string
  /** Visible label. */
  label: string
  /** Explanation below the row. */
  hint: string
  /** Current draft value. */
  checked: boolean
  /** Whether saving would leave a user-layer entry. */
  overridden: boolean
  /** Disables the control. */
  disabled: boolean
  /** Stage the next value. */
  onToggle: (next: boolean) => void
  /** Stage a clear. */
  onReset: () => void
  /** Copy for the override badge. */
  overriddenLabel: string
  /** Copy for the reset control. */
  resetLabel: string
  /** Draw the separator used between fields. */
  spaced?: boolean
}

/**
 * Render a staged boolean row.
 * @param props - field state, copy, and actions.
 * @returns the labelled switch row.
 */
export function SettingsToggleField(props: SettingsToggleFieldProps) {
  return (
    <div style={{ ...styles.field, ...(props.spaced === true ? styles.divider : null) }}>
      <div style={styles.head}>
        <span id={props.id} style={styles.label}>
          {props.label}
        </span>
        <div style={styles.badges}>
          {props.overridden ? <span style={styles.badge}>{props.overriddenLabel}</span> : null}
          <button
            type="button"
            style={styles.reset}
            disabled={props.disabled || !props.overridden}
            onClick={props.onReset}
          >
            {props.resetLabel}
          </button>
        </div>
        <Switch
          checked={props.checked}
          label={props.label}
          disabled={props.disabled}
          onChange={props.onToggle}
        />
      </div>
      <p style={styles.hint}>{props.hint}</p>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  divider: { borderTop: '0.5px solid var(--dsw-alias-border-l2)' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0' },
  head: { display: 'flex', alignItems: 'center', gap: 8 },
  label: {
    flex: '1 1 auto',
    minWidth: 0,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
  },
  badges: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  badge: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
  },
  reset: {
    border: 'none',
    background: 'none',
    padding: 0,
    font: 'inherit',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
  },
  hint: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-tertiary)',
  },
}
