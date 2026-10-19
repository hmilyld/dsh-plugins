/** Multi-line text field matching the official settings field chrome. */
import type { CSSProperties } from 'react'
import type { SettingsFieldProps } from '@deepseek-ai/dsh-client-ui-primitives'

/** Props for {@link SettingsTextareaField}. */
export interface SettingsTextareaFieldProps
  extends Omit<SettingsFieldProps, 'hint'> {
  /** Optional explanation below the control. */
  hint?: string
  /** Visible rows. */
  rows?: number
  /** Draw the separator used between fields. */
  spaced?: boolean
}

/**
 * Render a staged multi-line value.
 * @param props - field state, copy, and edit/reset actions.
 * @returns the labelled textarea.
 */
export function SettingsTextareaField(props: SettingsTextareaFieldProps) {
  const hintId = `${props.id}-hint`
  return (
    <div style={{ ...styles.field, ...(props.spaced === true ? styles.divider : null) }}>
      <div style={styles.head}>
        <label style={styles.label} htmlFor={props.id}>
          {props.label}
        </label>
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
      </div>
      <textarea
        id={props.id}
        rows={props.rows ?? 4}
        spellCheck={false}
        aria-invalid={props.invalid}
        aria-describedby={hintId}
        disabled={props.disabled}
        value={props.text}
        onChange={(event) => props.onEdit(event.target.value)}
        style={{
          ...styles.input,
          borderColor: props.invalid
            ? 'var(--dsw-alias-state-error-primary)'
            : 'var(--dsw-alias-border-l4)',
        }}
      />
      <p id={hintId} style={props.invalid ? styles.invalidText : styles.hint}>
        {props.invalid ? props.invalidLabel : (props.hint ?? '')}
      </p>
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
  invalidText: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-state-error-primary)',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    border: '0.5px solid var(--dsw-alias-border-l4)',
    borderRadius: 'var(--dsw-radius-md)',
    background: 'var(--dsw-alias-bg-layer-3)',
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
    resize: 'vertical',
  },
}
