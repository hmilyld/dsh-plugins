import { describe, expect, it } from 'vitest'
import { SESSION_FORMAT_VERSION, Session } from '@deepseek-ai/dsh-session'
import { dshSessionIdFor, isImportedSessionId, mapSession } from '../src/mapping.ts'
import type { OpencodeMessage, OpencodeSession } from '../src/opencode.ts'

const session: OpencodeSession = {
  id: 'ses_test',
  title: 'Imported conversation',
  directory: '/work/project',
  parentId: undefined,
  timeCreated: 1_000,
  timeUpdated: 2_000,
  archived: false,
}

const rows: OpencodeMessage[] = [
  { type: 'synthetic', seq: 1, time: 1_001, data: { text: 'system reminder' } },
  {
    type: 'user',
    seq: 2,
    time: 1_002,
    data: { text: 'hello', files: [{ name: 'notes.txt' }] },
  },
  {
    type: 'assistant',
    seq: 3,
    time: 1_003,
    data: {
      model: { id: 'model-a', providerID: 'provider-a' },
      tokens: { input: 10, output: 5, reasoning: 2, cache: { read: 3, write: 0 } },
      content: [
        { type: 'reasoning', text: 'thinking' },
        { type: 'text', text: 'hi there' },
        {
          type: 'tool',
          id: 'call_1',
          name: 'bash',
          state: { status: 'completed', input: { command: 'ls' }, content: [{ type: 'text', text: 'a.txt' }] },
        },
        {
          type: 'tool',
          id: 'call_2',
          name: 'edit',
          state: { status: 'error', input: { path: 'x' }, error: 'no such file' },
        },
      ],
    },
  },
  { type: 'user', seq: 4, time: 1_004, data: { text: 'again' } },
  {
    type: 'assistant',
    seq: 5,
    time: 1_005,
    data: {
      model: { id: 'model-a', providerID: 'provider-a' },
      content: [{ type: 'text', text: 'done' }],
    },
  },
]

const options = { includeToolCalls: true, includeReasoning: true, maxMessages: 0 }

describe('session id minting', () => {
  it('derives a stable, recognizable id', () => {
    const first = dshSessionIdFor('ses_test')
    expect(first).toBe(dshSessionIdFor('ses_test'))
    expect(first.startsWith('session-oc-')).toBe(true)
    expect(first).toHaveLength('session-oc-'.length + 24)
    expect(isImportedSessionId(first)).toBe(true)
    expect(isImportedSessionId('session-123')).toBe(false)
  })
})

describe('mapSession', () => {
  it('maps user text, assistant content, tools, and the title', () => {
    const { events } = mapSession(session, rows, options)
    expect(events.map((event) => event.type)).toEqual([
      'turn/start',
      'step/start',
      'user/message',
      'assistant/message',
      'tool/call',
      'tool/result',
      'tool/call',
      'tool/result',
      'step/end',
      'turn/end',
      'turn/start',
      'step/start',
      'user/message',
      'assistant/message',
      'step/end',
      'turn/end',
      'session/title',
    ])
    const firstUser = events[2]!.data as {
      content: { type: string; text: string }[]
      source: { kind: string }
    }
    expect(firstUser.content[0]).toEqual({ type: 'text', text: 'hello' })
    expect(firstUser.content[1]).toEqual({ type: 'text', text: '[附件: notes.txt]' })
    const assistant = events[3]!.data as {
      message: { content: { type: string }[]; source: { provider: string; model: string } }
      usage: Record<string, number>
    }
    expect(assistant.message.content.map((block) => block.type)).toEqual([
      'reasoning',
      'text',
      'tool-call',
      'tool-call',
    ])
    expect(assistant.message.source).toMatchObject({ provider: 'provider-a', model: 'model-a' })
    expect(assistant.usage).toMatchObject({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 3 })
    const failed = events[7]!.data as { message: { isError?: boolean; content: { text: string }[] } }
    expect(failed.message.isError).toBe(true)
    expect(failed.message.content[0]?.text).toBe('no such file')
    const title = events.at(-1)!.data as { title: string; source: { kind: string } }
    expect(title).toMatchObject({ title: 'Imported conversation', source: { kind: 'user' } })
  })

  it('drops reasoning and tool calls when asked to', () => {
    const { events } = mapSession(session, rows, {
      includeToolCalls: false,
      includeReasoning: false,
      maxMessages: 0,
    })
    const assistant = events.find((event) => event.type === 'assistant/message')!
    const data = assistant.data as { message: { content: { type: string }[] } }
    expect(data.message.content.map((block) => block.type)).toEqual(['text'])
    expect(events.some((event) => event.type === 'tool/call')).toBe(false)
  })

  it('keeps only the newest messages when capped', () => {
    const { events } = mapSession(session, rows, { ...options, maxMessages: 2 })
    const users = events.filter((event) => event.type === 'user/message')
    expect(users).toHaveLength(1)
    const data = users[0]!.data as { content: { text: string }[] }
    expect(data.content[0]?.text).toBe('again')
  })

  it('produces events the real Session store accepts', () => {
    const { events } = mapSession(session, rows, options)
    const header = {
      version: SESSION_FORMAT_VERSION,
      id: dshSessionIdFor(session.id),
      createdAt: session.timeCreated,
      cwd: session.directory,
      isSeeded: false,
    }
    const restored = Session.create(header.id, events, header)
    const messages = restored.deriveMessages()
    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'tool',
      'user',
      'assistant',
    ])
  })

  it('falls back to the first user text when OpenCode has no title', () => {
    const { events } = mapSession({ ...session, title: '' }, rows, options)
    const title = events.at(-1)!.data as { title: string }
    expect(title.title).toBe('hello')
  })

  it('emits nothing for a session without conversation rows', () => {
    const { events } = mapSession(session, rows.filter((row) => row.type === 'synthetic'), options)
    expect(events).toEqual([])
  })
})
