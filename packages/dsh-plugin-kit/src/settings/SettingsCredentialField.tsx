/** Write-only credential control plus the deprecated-literal migration notice. */
import type { CSSProperties } from 'react'
import { SettingsSecretField } from '@deepseek-ai/dsh-client-ui-primitives'

/** Optional legacy-secret migration block. */
export interface LegacyCredentialNotice {
  /** Whether the deprecated field still holds a value. */
  visible: boolean
  /** Explanation shown beside the clear action. */
  message: string
  /** Clear action copy. */
  actionLabel: string
  /** Stage the clear. */
  onClear: () => void
  /** Disables the clear action. */
  disabled?: boolean
  /** Failure copy shown under the notice. */
  failed?: string
}

/** Props for {@link SettingsCredentialField}. */
export interface SettingsCredentialFieldProps {
  /** Stable control id. */
  id: string
  /** Visible label. */
  label: string
  /** Explanation below the control. */
  hint: string
  /** Staged secret literal; starts blank on every load. */
  text: string
  /** Disables the secret input. */
  disabled: boolean
  /** Whether the Host reports a configured credential. */
  configured: boolean
  /** Copy describing the configured state. */
  stateLabel: string
  /** Stage the secret text. */
  onEdit: (text: string) => void
  /** Optional migration block for the deprecated literal. */
  legacy?: LegacyCredentialNotice
}

/**
 * Render the standard credential control and, when needed, the legacy notice.
 * @param props - secret state and optional migration state.
 * @returns the field.
 */
export function SettingsCredentialField(props: SettingsCredentialFieldProps) {
  const legacy = props.legacy
  return (
    <>
      <SettingsSecretField
        id={props.id}
        label={props.label}
        hint={props.hint}
        text={props.text}
        disabled={props.disabled}
        onEdit={props.onEdit}
        configured={props.configured}
        stateLabel={props.stateLabel}
      />
      {legacy?.visible === true ? (
        <div style={styles.notice}>
          <span>{legacy.message}</span>
          <button
            type="button"
            style={styles.button}
            onClick={legacy.onClear}
            disabled={legacy.disabled === true}
          >
            {legacy.actionLabel}
          </button>
          {legacy.failed !== undefined ? (
            <span style={styles.error} role="alert">
              {legacy.failed}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
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
    border: '1px solid var(--dsw-alias-state-warning-border, #f59e0b)',
    background: 'var(--dsw-alias-state-warning-bg, rgba(245, 158, 11, 0.08))',
    color: 'var(--dsw-alias-label-secondary, #6b7280)',
    fontSize: 12,
    lineHeight: '18px',
  },
  error: {
    flexBasis: '100%',
    color: 'var(--dsw-alias-state-error-primary, #ef4444)',
    fontSize: 12,
    lineHeight: '18px',
  },
  button: {
    appearance: 'none',
    border: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
    background: 'transparent',
    color: 'var(--dsw-alias-label-primary, #111827)',
    borderRadius: 6,
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: 12,
  },
}
