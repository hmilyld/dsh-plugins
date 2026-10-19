import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const React = await import('react')
  return {
    SettingsForm: ({ children }: { children: unknown }) => React.createElement('div', null, children),
    SettingsSecretField: ({ label, stateLabel }: { label: string; stateLabel: string }) =>
      React.createElement('div', null, `${label}: ${stateLabel}`),
    SettingsValueField: () => null,
    Switch: ({ label }: { label: string }) => React.createElement('span', { 'aria-label': label }),
    settingsNumberField: (field: string) => ({ field, format: () => '', parse: () => undefined }),
    settingsTextField: (field: string) => ({ field, format: () => '', parse: () => undefined }),
  }
})
import {
  PluginSettingsForm,
  SettingsCredentialField,
  SettingsTextareaField,
  SettingsToggleField,
  formLabels,
} from '../src/index.ts'

const labels = {
  overriddenLabel: 'Overridden',
  resetLabel: 'Reset',
  invalidLabel: 'Invalid',
} as const

const common = (key: string) => key

describe('settings fields', () => {
  it('renders a labelled textarea with the current draft', () => {
    const html = renderToStaticMarkup(
      <SettingsTextareaField
        id="template"
        label="Payload template"
        hint="Valid JSON"
        text='{"a":1}'
        overridden={false}
        invalid={false}
        disabled={false}
        onEdit={() => {}}
        onReset={() => {}}
        {...labels}
      />,
    )
    expect(html).toContain('for="template"')
    expect(html).toContain('Payload template')
    expect(html).toContain('Valid JSON')
    expect(html).toContain('{&quot;a&quot;:1}')
  })

  it('renders a toggle row tied to the same label', () => {
    const html = renderToStaticMarkup(
      <SettingsToggleField
        id="skip"
        label="Skip subagents"
        hint="Do not notify subagent turns"
        checked
        overridden={false}
        disabled={false}
        onToggle={() => {}}
        onReset={() => {}}
        {...labels}
      />,
    )
    expect(html).toContain('Skip subagents')
    expect(html).toContain('Do not notify subagent turns')
    expect(html).toContain('aria-label="Skip subagents"')
  })

  it('renders the standard shell with the update notice on top', () => {
    const html = renderToStaticMarkup(
      <PluginSettingsForm
        state={{
          available: true,
          writable: true,
          dirty: false,
          invalid: false,
          saving: false,
          failed: false,
        }}
        labels={formLabels(common)}
        onSave={() => {}}
        onDiscard={() => {}}
        update={{
          packageName: '@hmilyld/dsh-beacon',
          currentVersion: '0.2.2',
          latestVersion: '0.3.0',
          updateAvailable: true,
          checkedAt: 1,
          error: null,
        }}
        changelogUrl="https://example.test/CHANGELOG.md"
        updateLabels={{ available: 'New v{latest}', changelog: 'Notes' }}
      >
        <span>fields</span>
      </PluginSettingsForm>,
    )
    expect(html).toContain('New v0.3.0')
    expect(html).toContain('Notes')
    expect(html).toContain('fields')
  })

  it('shows the legacy credential notice only when requested', () => {
    const base = {
      id: 'key',
      label: 'API key',
      hint: 'Stored outside settings',
      text: '',
      disabled: false,
      configured: true,
      stateLabel: 'Configured',
      onEdit: () => {},
    }
    const without = renderToStaticMarkup(<SettingsCredentialField {...base} />)
    expect(without).not.toContain('Clear deprecated key')
    const withLegacy = renderToStaticMarkup(
      <SettingsCredentialField
        {...base}
        legacy={{
          visible: true,
          message: 'The deprecated field still wins',
          actionLabel: 'Clear deprecated key',
          onClear: () => {},
        }}
      />,
    )
    expect(withLegacy).toContain('The deprecated field still wins')
    expect(withLegacy).toContain('Clear deprecated key')
  })
})
