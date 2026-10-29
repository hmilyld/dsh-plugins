/**
 * Pure OpenCode → DSH Session event mapping.
 *
 * The shape here is validated against the real Session store in tests; keep the
 * builder free of Cordis and filesystem dependencies so it stays replayable in
 * a unit test with recorded OpenCode rows.
 */
import { createHash, randomUUID } from 'node:crypto'
import { MAX_TITLE_CHARS, SESSION_ID_PREFIX } from './constants.ts'
import type { OpencodeMessage, OpencodeSession } from './opencode.ts'
import type { SessionEventLike } from './ports.ts'

/** What the caller allows into the imported transcript. */
export interface MappingOptions {
  /** Import tool calls and their results. */
  includeToolCalls: boolean
  /** Import assistant reasoning blocks. */
  includeReasoning: boolean
  /** Keep only the newest N conversation messages; `0` keeps all. */
  maxMessages: number
}

/** Result of one session mapping. */
export interface MappingResult {
  /** Append-valid DSH events in log order. */
  events: SessionEventLike[]
}

/** Deterministic DSH session id for one OpenCode session. */
export function dshSessionIdFor(opencodeSessionId: string): string {
  const digest = createHash('sha256').update(opencodeSessionId).digest('hex').slice(0, 24)
  return `${SESSION_ID_PREFIX}${digest}`
}

/** Whether a DSH session id was minted by this plugin. */
export function isImportedSessionId(sessionId: string): boolean {
  return sessionId.startsWith(SESSION_ID_PREFIX)
}

/** Narrow one unknown JSON value to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read one optional finite number. */
function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Serialize tool input without ever throwing. */
function stringifyArguments(input: unknown): string {
  try {
    return JSON.stringify(input ?? {})
  } catch {
    return '{}'
  }
}

/** Collapse whitespace and cap a title. */
function normalizeTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  return collapsed.length > MAX_TITLE_CHARS ? collapsed.slice(0, MAX_TITLE_CHARS) : collapsed
}

/** Append-only builder that owns seq and monotonic timestamps. */
class EventBuilder {
  readonly events: SessionEventLike[] = []
  private seq = 0
  private lastTime = 0

  /** Append one event at or after the previous event's time. */
  push(type: string, data: unknown, extra: Record<string, unknown> = {}): void {
    const time = this.lastTime
    this.events.push({ type, seq: this.seq++, time, data, ...extra } as SessionEventLike)
  }

  /** Advance the clock to a source timestamp without ever moving backwards. */
  at(source: number | undefined): void {
    if (source !== undefined && Number.isFinite(source) && source > this.lastTime) {
      this.lastTime = source
    }
  }
}

/** Blocks of one OpenCode user message. */
function userContent(data: Record<string, unknown>): unknown[] {
  const content: unknown[] = []
  const text = typeof data.text === 'string' ? data.text : ''
  if (text.trim().length > 0) content.push({ type: 'text', text })
  const files = Array.isArray(data.files) ? data.files : []
  for (const file of files) {
    const name = isRecord(file) && typeof file.name === 'string' ? file.name : 'attachment'
    content.push({ type: 'text', text: `[附件: ${name}]` })
  }
  return content
}

/** One planned tool call and the result content it answers with. */
interface MappedTool {
  callId: string
  name: string
  arguments: string
  content: unknown[]
  isError: boolean
}

/** Result blocks of one OpenCode tool part. */
function toolContent(state: Record<string, unknown> | undefined): unknown[] {
  const content: unknown[] = []
  const raw = state?.content
  if (Array.isArray(raw)) {
    for (const block of raw) {
      if (isRecord(block) && typeof block.text === 'string') {
        content.push({ type: 'text', text: block.text })
      }
    }
  }
  if (content.length === 0 && typeof state?.output === 'string') {
    content.push({ type: 'text', text: state.output })
  }
  if (content.length === 0 && typeof state?.error === 'string') {
    content.push({ type: 'text', text: state.error })
  }
  if (content.length === 0) {
    content.push({ type: 'text', text: '（OpenCode 未记录工具结果）' })
  }
  return content
}

/** Whether one tool part ended in failure. */
function toolFailed(state: Record<string, unknown> | undefined): boolean {
  return state?.status === 'error' || typeof state?.error === 'string'
}

/** Provider and model identity recorded by OpenCode. */
function modelOf(data: Record<string, unknown>): { provider: string; model: string } {
  const raw = data.model
  if (typeof raw === 'string') return { provider: 'opencode', model: raw }
  if (isRecord(raw)) {
    return {
      provider: typeof raw.providerID === 'string' ? raw.providerID : 'opencode',
      model: typeof raw.id === 'string' ? raw.id : 'unknown',
    }
  }
  return { provider: 'opencode', model: 'unknown' }
}

/** Token accounting recorded by OpenCode, when present. */
function usageOf(data: Record<string, unknown>): Record<string, number> | undefined {
  const tokens = data.tokens
  if (!isRecord(tokens)) return undefined
  const usage: Record<string, number> = {}
  const input = numberOf(tokens.input)
  const output = numberOf(tokens.output)
  const reasoning = numberOf(tokens.reasoning)
  const cache = isRecord(tokens.cache) ? tokens.cache : undefined
  const cacheRead = cache === undefined ? undefined : numberOf(cache.read)
  const cacheWrite = cache === undefined ? undefined : numberOf(cache.write)
  if (input !== undefined) usage.inputTokens = input
  if (output !== undefined) usage.outputTokens = output
  if (reasoning !== undefined) usage.reasoningTokens = reasoning
  if (cacheRead !== undefined) usage.cacheReadTokens = cacheRead
  if (cacheWrite !== undefined) usage.cacheWriteTokens = cacheWrite
  return Object.keys(usage).length === 0 ? undefined : usage
}

/** Assistant blocks and planned tool calls of one OpenCode message. */
function assistantContent(
  data: Record<string, unknown>,
  options: MappingOptions,
): { content: unknown[]; tools: MappedTool[]; usage: Record<string, number> | undefined } {
  const content: unknown[] = []
  const tools: MappedTool[] = []
  const parts = Array.isArray(data.content) ? data.content : []
  for (const part of parts) {
    if (!isRecord(part)) continue
    if (part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0) {
      content.push({ type: 'text', text: part.text })
      continue
    }
    if (part.type === 'reasoning' && typeof part.text === 'string' && part.text.trim().length > 0) {
      if (options.includeReasoning) content.push({ type: 'reasoning', text: part.text })
      continue
    }
    if (part.type === 'tool' && options.includeToolCalls) {
      const state = isRecord(part.state) ? part.state : undefined
      const callId = typeof part.id === 'string' ? part.id : randomUUID()
      const name = typeof part.name === 'string' ? part.name : 'tool'
      const args = stringifyArguments(state?.input)
      content.push({ type: 'tool-call', id: callId, name, arguments: args })
      tools.push({
        callId,
        name,
        arguments: args,
        content: toolContent(state),
        isError: toolFailed(state),
      })
    }
  }
  return { content, tools, usage: usageOf(data) }
}

/** First non-empty human text in the kept window. */
function firstUserText(rows: readonly OpencodeMessage[]): string {
  for (const row of rows) {
    if (row.type !== 'user') continue
    const text = typeof row.data.text === 'string' ? row.data.text : ''
    if (text.trim().length > 0) return text
  }
  return ''
}

/**
 * Map one OpenCode conversation into append-valid DSH session events.
 *
 * @param session - the OpenCode session row (identity and title).
 * @param rows - its stored events in sequence order.
 * @param options - transcript options.
 * @returns events ending with a pinned `session/title`; may be empty.
 */
export function mapSession(
  session: OpencodeSession,
  rows: readonly OpencodeMessage[],
  options: MappingOptions,
): MappingResult {
  const conversation = rows.filter((row) => row.type === 'user' || row.type === 'assistant')
  const kept =
    options.maxMessages > 0 && conversation.length > options.maxMessages
      ? conversation.slice(conversation.length - options.maxMessages)
      : conversation
  const builder = new EventBuilder()
  let turn = 0
  let step = 0
  let turnOpen = false
  let stepOpen = false
  let hasConversation = false

  const closeStep = (): void => {
    if (!stepOpen) return
    builder.push('step/end', { turn, step })
    stepOpen = false
  }
  const closeTurn = (): void => {
    closeStep()
    if (!turnOpen) return
    builder.push('turn/end', { turn, reason: { kind: 'completed' } })
    turnOpen = false
  }
  const openTurn = (): void => {
    turn += 1
    step = 0
    builder.push('turn/start', { turn })
    turnOpen = true
  }
  const openStep = (): void => {
    step += 1
    builder.push('step/start', { turn, step })
    stepOpen = true
  }

  for (const row of kept) {
    builder.at(row.time)
    if (row.type === 'user') {
      const content = userContent(row.data)
      if (content.length === 0) continue
      closeTurn()
      openTurn()
      openStep()
      hasConversation = true
      builder.push(
        'user/message',
        { id: randomUUID(), role: 'user', content, source: { kind: 'user' } },
        { surfaceOp: 'append' },
      )
      continue
    }
    const mapped = assistantContent(row.data, options)
    if (mapped.content.length === 0) continue
    if (!turnOpen) openTurn()
    if (!stepOpen) openStep()
    hasConversation = true
    const identity = modelOf(row.data)
    builder.push(
      'assistant/message',
      {
        turn,
        step,
        message: {
          id: randomUUID(),
          role: 'assistant',
          content: mapped.content,
          source: { kind: 'model', provider: identity.provider, model: identity.model },
        },
        stream: [],
        ...(mapped.usage === undefined ? {} : { usage: mapped.usage }),
      },
      { surfaceOp: 'append' },
    )
    for (const tool of mapped.tools) {
      builder.push('tool/call', {
        turn,
        step,
        callId: tool.callId,
        name: tool.name,
        arguments: tool.arguments,
      })
      builder.push(
        'tool/result',
        {
          turn,
          step,
          message: {
            id: randomUUID(),
            role: 'tool',
            source: { kind: 'tool', callId: tool.callId },
            toolCallId: tool.callId,
            content: tool.content,
            ...(tool.isError ? { isError: true } : {}),
          },
        },
        { surfaceOp: 'append' },
      )
    }
    closeStep()
  }
  closeTurn()
  if (!hasConversation) return { events: [] }

  const title = normalizeTitle(session.title.length > 0 ? session.title : firstUserText(kept))
  if (title.length > 0) {
    builder.push('session/title', { title, messageSeqs: [], source: { kind: 'user' } })
  }
  return { events: builder.events }
}
