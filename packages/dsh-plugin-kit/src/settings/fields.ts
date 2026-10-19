/** Field conversion helpers shared by plugin settings forms. */
import type { SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * A whole-second draft stored as milliseconds. An empty draft clears the field;
 * any other draft must be an integer at or above the minimum.
 * @param field - section field name.
 * @param minimumSeconds - smallest accepted value.
 * @returns the conversion spec.
 */
export function settingsSecondsField(field: string, minimumSeconds: number): SettingsFieldSpec {
  return {
    field,
    format: (value) =>
      typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value / 1000)) : '',
    parse: (text) => {
      if (text.trim() === '') return { kind: 'clear' }
      const seconds = Number(text)
      return Number.isInteger(seconds) && seconds >= minimumSeconds
        ? { kind: 'set', value: seconds * 1000 }
        : undefined
    },
  }
}

/**
 * A boolean draft rendered as `"true"` / `"false"`, matching `Switch` events.
 * @param field - section field name.
 * @returns the conversion spec.
 */
export function settingsBooleanField(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'boolean' ? String(value) : ''),
    parse: (text) => {
      if (text === 'true') return { kind: 'set', value: true }
      if (text === 'false') return { kind: 'set', value: false }
      return undefined
    },
  }
}
