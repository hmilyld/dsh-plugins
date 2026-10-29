import { describe, expect, it } from 'vitest'
import { headerFor, planImports, runImport } from '../src/importer.ts'
import type { ImportPorts, WorkspaceTarget } from '../src/importer.ts'
import { dshSessionIdFor } from '../src/mapping.ts'
import type { OpencodeMessage, OpencodeSession } from '../src/opencode.ts'

function session(overrides: Partial<OpencodeSession> = {}): OpencodeSession {
  return {
    id: 'ses_1',
    title: 'One',
    directory: '/work/a',
    parentId: undefined,
    timeCreated: 1_000,
    timeUpdated: 2_000,
    archived: false,
    ...overrides,
  }
}

const workspace: WorkspaceTarget = {
  id: 'ws-a',
  path: '/work/a',
  attach: async () => {},
}

const rows: OpencodeMessage[] = [
  { type: 'user', seq: 1, time: 1_000, data: { text: 'hello' } },
  {
    type: 'assistant',
    seq: 2,
    time: 1_001,
    data: { content: [{ type: 'text', text: 'hi' }] },
  },
]

describe('planImports', () => {
  it('matches root sessions by canonical directory', () => {
    const planned = planImports(
      [
        session(),
        session({ id: 'ses_child', parentId: 'ses_1' }),
        session({ id: 'ses_archived', archived: true }),
        session({ id: 'ses_other', directory: '/work/b' }),
      ],
      [workspace],
    )
    expect(planned.plans.map((plan) => plan.session.id)).toEqual(['ses_1'])
    expect(planned.unmatchedSessions).toBe(1)
    expect(planned.unmatchedDirectories).toEqual(['/work/b'])
  })

  it('orders plans oldest first and unmatched directories by recency', () => {
    const planned = planImports(
      [
        session({ id: 'ses_new', timeCreated: 3_000 }),
        session({ id: 'ses_old', timeCreated: 1_000 }),
        session({ id: 'ses_x', directory: '/work/x', timeUpdated: 5_000 }),
        session({ id: 'ses_y', directory: '/work/y', timeUpdated: 9_000 }),
      ],
      [workspace],
    )
    expect(planned.plans.map((plan) => plan.session.id)).toEqual(['ses_old', 'ses_new'])
    expect(planned.unmatchedDirectories).toEqual(['/work/y', '/work/x'])
  })

  it('honours excluded directories and their descendants', () => {
    const planned = planImports(
      [
        session({ id: 'ses_a', directory: '/work/a' }),
        session({ id: 'ses_sub', directory: '/work/a/sub' }),
        session({ id: 'ses_b', directory: '/work/ab' }),
      ],
      [workspace, { id: 'ws-sub', path: '/work/a/sub', attach: async () => {} }],
      ['/work/a/sub'],
    )
    expect(planned.plans.map((plan) => plan.session.id)).toEqual(['ses_a'])
  })
})

describe('runImport', () => {
  const mapping = { includeToolCalls: true, includeReasoning: true, maxMessages: 0 }

  it('writes, warms, and attaches a new session', async () => {
    const calls: string[] = []
    const ports: ImportPorts = {
      isImported: async () => false,
      write: async (header) => {
        calls.push(`write:${String(header.id)}`)
      },
      warm: async (id) => {
        calls.push(`warm:${id}`)
      },
      loadMessages: () => rows,
      attach: async () => {
        calls.push('attach')
      },
    }
    const outcome = await runImport(
      [{ session: session(), workspace }],
      ports,
      4,
      mapping,
      10,
    )
    const id = dshSessionIdFor('ses_1')
    expect(outcome).toEqual({ imported: 1, skipped: 0, failed: 0, errors: [] })
    expect(calls).toEqual([`write:${id}`, `warm:${id}`, 'attach'])
  })

  it('skips sessions that already exist', async () => {
    const calls: string[] = []
    const outcome = await runImport(
      [{ session: session(), workspace }],
      {
        isImported: async () => true,
        write: async () => {
          calls.push('write')
        },
        warm: async () => {
          calls.push('warm')
        },
        loadMessages: () => rows,
        attach: async () => {
          calls.push('attach')
        },
      },
      4,
      mapping,
      10,
    )
    expect(outcome).toEqual({ imported: 0, skipped: 1, failed: 0, errors: [] })
    expect(calls).toEqual([])
  })

  it('contains one failure and keeps importing', async () => {
    const outcome = await runImport(
      [
        { session: session({ id: 'ses_bad' }), workspace },
        { session: session({ id: 'ses_good' }), workspace },
      ],
      {
        isImported: async () => false,
        write: async (header) => {
          if (header.id === dshSessionIdFor('ses_bad')) throw new Error('disk full')
        },
        warm: async () => {},
        loadMessages: () => rows,
        attach: async () => {},
      },
      4,
      mapping,
      10,
    )
    expect(outcome.imported).toBe(1)
    expect(outcome.failed).toBe(1)
    expect(outcome.errors[0]).toContain('ses_bad')
    expect(outcome.errors[0]).toContain('disk full')
  })

  it('skips a session whose mapping produced no events', async () => {
    const outcome = await runImport(
      [{ session: session(), workspace }],
      {
        isImported: async () => false,
        write: async () => {},
        warm: async () => {},
        loadMessages: () => rows.filter((row) => row.type === 'system'),
        attach: async () => {},
      },
      4,
      mapping,
      10,
    )
    expect(outcome.skipped).toBe(1)
  })
})

describe('headerFor', () => {
  it('stamps the format version, canonical cwd, and deterministic id', () => {
    expect(headerFor(4, session(), workspace)).toEqual({
      version: 4,
      id: dshSessionIdFor('ses_1'),
      createdAt: 1_000,
      cwd: '/work/a',
      isSeeded: false,
    })
  })
})
