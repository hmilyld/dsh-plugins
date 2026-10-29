/** Settings card: database status, scan action, transcript options, preview. */
import type { CSSProperties } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  formLabels,
  PluginSettingsForm,
  SettingsTextareaField,
  SettingsToggleField,
  SettingsValueField,
} from '@hmilyld/dsh-plugin-kit'
import type { Face, PreviewState, SettingsState } from './controller.ts'
import { NS, type LocaleKey } from './locales.ts'

export type SettingsCardProps = PropsRuntime<'plugins.bundle.config'> &
  PropsLocale<typeof NS> &
  InjectFace<Face>

/**
 * Render the OpenCode import settings page.
 *
 * @param props - slot props with the staged form, preview, and update stores.
 * @returns the standard settings frame with status, options, and preview.
 */
export function SettingsCard(props: SettingsCardProps) {
  const t = props.t as (key: LocaleKey) => string
  if (props.view === 'summary') return <>{t('description')}</>
  const state = props.useSettings((value) => value)
  const preview = props.usePreview((value) => value)
  const update = props.useUpdate((value) => value)
  const disabled = !state.writable || state.saving
  return (
    <PluginSettingsForm
      state={state}
      labels={formLabels(t)}
      onSave={props.save}
      onDiscard={props.discard}
      update={update}
      changelogUrl={__PKG_CHANGELOG_URL__}
      updateLabels={{ available: t('updateAvailable'), changelog: t('updateChangelog') }}
    >
      <StatusBlock state={state} t={t} />
      <SettingsValueField
        id="opencode-import-db-path"
        label={t('databasePath')}
        hint={t('databasePathHint')}
        text={state.dbPath.text}
        overridden={state.dbPath.overridden}
        invalid={state.dbPath.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidValue')}
        disabled={disabled}
        placeholder="~/.local/share/opencode/opencode.db"
        onEdit={(text) => props.edit('dbPath', text)}
        onReset={() => props.resetField('dbPath')}
      />
      <SettingsToggleField
        id="opencode-import-auto-scan"
        label={t('autoScan')}
        hint={t('autoScanHint')}
        checked={state.autoScanOnStart.text !== 'false'}
        overridden={state.autoScanOnStart.overridden}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        onToggle={(next) => props.edit('autoScanOnStart', String(next))}
        onReset={() => props.resetField('autoScanOnStart')}
      />
      <SettingsToggleField
        id="opencode-import-scan-workspace"
        label={t('scanOnWorkspace')}
        hint={t('scanOnWorkspaceHint')}
        checked={state.scanOnWorkspaceCreate.text !== 'false'}
        overridden={state.scanOnWorkspaceCreate.overridden}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        onToggle={(next) => props.edit('scanOnWorkspaceCreate', String(next))}
        onReset={() => props.resetField('scanOnWorkspaceCreate')}
      />
      <SettingsToggleField
        id="opencode-import-tools"
        label={t('includeToolCalls')}
        hint={t('includeToolCallsHint')}
        checked={state.includeToolCalls.text !== 'false'}
        overridden={state.includeToolCalls.overridden}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        onToggle={(next) => props.edit('includeToolCalls', String(next))}
        onReset={() => props.resetField('includeToolCalls')}
      />
      <SettingsToggleField
        id="opencode-import-reasoning"
        label={t('includeReasoning')}
        hint={t('includeReasoningHint')}
        checked={state.includeReasoning.text !== 'false'}
        overridden={state.includeReasoning.overridden}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        onToggle={(next) => props.edit('includeReasoning', String(next))}
        onReset={() => props.resetField('includeReasoning')}
      />
      <SettingsValueField
        id="opencode-import-max-messages"
        label={t('maxMessages')}
        hint={t('maxMessagesHint')}
        text={state.maxMessagesPerSession.text}
        overridden={state.maxMessagesPerSession.overridden}
        invalid={state.maxMessagesPerSession.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        numeric
        onEdit={(text) => props.edit('maxMessagesPerSession', text)}
        onReset={() => props.resetField('maxMessagesPerSession')}
      />
      <SettingsTextareaField
        id="opencode-import-excluded"
        label={t('excludedDirectories')}
        hint={t('excludedDirectoriesHint')}
        rows={3}
        text={state.excludedDirectories.text}
        overridden={state.excludedDirectories.overridden}
        invalid={state.excludedDirectories.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidValue')}
        disabled={disabled}
        onEdit={(text) => props.edit('excludedDirectories', text)}
        onReset={() => props.resetField('excludedDirectories')}
      />
      <ScanBlock
        state={state}
        disabled={disabled}
        t={t}
        onScan={props.scan}
        onRefresh={props.refreshPreview}
      />
      <PreviewBlock preview={preview} t={t} />
    </PluginSettingsForm>
  )
}

/** Database reachability and session counts. */
function StatusBlock({ state, t }: { state: SettingsState; t: (key: LocaleKey) => string }) {
  const status = state.status
  const availability =
    status === null
      ? null
      : status.dbAvailable
        ? t('databaseReady')
        : status.schema === 'unsupported'
          ? t('databaseUnsupported')
          : t('databaseMissing')
  return (
    <section style={styles.block} aria-label={t('database')}>
      <div style={styles.heading}>{t('database')}</div>
      <div style={styles.mono}>{status?.dbPath ?? '—'}</div>
      {availability === null ? null : <div style={styles.muted}>{availability}</div>}
      {status === null ? null : (
        <div style={styles.muted}>
          {t('opencodeSessions')}: {status.opencodeSessions} · {t('importedSessions')}:{' '}
          {status.importedSessions}
        </div>
      )}
    </section>
  )
}

/** Scan action and last report. */
function ScanBlock({
  state,
  disabled,
  t,
  onScan,
  onRefresh,
}: {
  state: SettingsState
  disabled: boolean
  t: (key: LocaleKey) => string
  onScan: () => void
  onRefresh: () => void
}) {
  const report = state.status?.lastReport ?? null
  return (
    <section style={styles.block} aria-label={t('scanNow')}>
      <div style={styles.actions}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || state.scanning}
          onClick={onScan}
        >
          {state.scanning ? t('scanning') : t('scanNow')}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={state.scanning} onClick={onRefresh}>
          {t('preview')}
        </Button>
      </div>
      {state.scanError === null ? null : (
        <p role="alert" style={styles.error}>
          {t('scanFailed')} {state.scanError}
        </p>
      )}
      <div style={styles.muted} role="status">
        {report === null
          ? t('neverScanned')
          : `${t('lastScan')}: ${new Date(report.finishedAt).toLocaleString()} · ${t('reportImported')} ${report.imported} · ${t('reportSkipped')} ${report.skipped} · ${t('reportFailed')} ${report.failed} · ${t('reportUnmatched')} ${report.unmatchedSessions}`}
      </div>
      {report !== null && report.errors.length > 0 ? (
        <div style={styles.muted}>
          <div>{t('reportErrors')}</div>
          <ul style={styles.errors}>
            {report.errors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/** Read-only list of OpenCode sessions and their match state. */
function PreviewBlock({
  preview,
  t,
}: {
  preview: PreviewState
  t: (key: LocaleKey) => string
}) {
  return (
    <section style={styles.block} aria-label={t('preview')}>
      <div style={styles.heading}>{t('preview')}</div>
      <div style={styles.muted}>{t('previewHint')}</div>
      {preview.error === null ? null : (
        <p role="alert" style={styles.error}>
          {preview.error}
        </p>
      )}
      {preview.rows.length === 0 ? (
        <div style={styles.muted}>{preview.loading ? t('scanning') : t('previewEmpty')}</div>
      ) : (
        <ul style={styles.rows}>
          {preview.rows.slice(0, 40).map((row) => (
            <li key={row.opencodeSessionId} style={styles.row}>
              <span style={styles.rowTitle}>{row.title.length > 0 ? row.title : row.opencodeSessionId}</span>
              <span style={styles.rowMeta}>
                {row.workspacePath === null
                  ? t('previewUnmatched')
                  : row.imported
                    ? t('previewImported')
                    : t('previewPending')}
                {' · '}
                {row.messageCount}
              </span>
              <span style={styles.rowPath}>{row.workspacePath ?? row.directory}</span>
            </li>
          ))}
        </ul>
      )}
      {preview.truncated ? <div style={styles.muted}>{t('previewTruncated')}</div> : null}
      {preview.unmatchedDirectories.length === 0 ? null : (
        <div style={styles.muted}>
          <div>{t('previewUnmatched')}</div>
          <ul style={styles.errors}>
            {preview.unmatchedDirectories.slice(0, 10).map((directory) => (
              <li key={directory}>{directory}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const styles: Record<string, CSSProperties> = {
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '12px 0',
    borderTop: '0.5px solid var(--dsw-alias-border-l2)',
  },
  heading: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
  },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  muted: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
  },
  mono: {
    fontFamily: 'var(--dsw-font-mono, ui-monospace, SFMono-Regular, monospace)',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
    overflowWrap: 'anywhere',
  },
  error: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-danger, var(--dsw-alias-label-secondary))',
  },
  errors: { margin: '4px 0 0', paddingInlineStart: 16, fontSize: 12, lineHeight: 1.5 },
  rows: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 4,
    padding: '6px 8px',
    borderRadius: 6,
    background: 'var(--dsw-alias-bg-l2)',
  },
  rowTitle: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    fontSize: 11,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
    whiteSpace: 'nowrap',
  },
  rowPath: {
    gridColumn: '1 / -1',
    fontSize: 11,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-tertiary)',
    overflowWrap: 'anywhere',
  },
}
