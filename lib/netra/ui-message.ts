import type { UIMessage } from 'ai'

export type StoredNetraMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type NetraToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | 'output-denied'
  | 'approval-requested'
  | 'approval-responded'

export type NetraToolView = {
  id: string
  name: string
  state: NetraToolState
  traces: Array<{ title: string; permalink: string }>
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}

export function uiMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/**
 * NETRA's transcript is deliberately plain text. Models can still emit light
 * Markdown despite the prompt contract, so remove presentation syntax at the
 * display boundary while preserving line breaks and same-site paths.
 */
export function plainNetraText(value: string): string {
  return value
    .replace(/```(?:[a-z0-9_-]+)?\n?/gi, '')
    .replace(/<\/?[a-z][^>\n]*>/gi, '')
    .replace(/^ {0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^ {0,3}>[ \t]?/gm, '')
    .replace(/^([ \t]*)[*+][ \t]+/gm, '$1- ')
    .replace(/\[([^\]\n]+)\]\((\/[^)\s]*)\)/g, '$1 ($2)')
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
}

export function userMessagesForRequest(messages: readonly UIMessage[]): StoredNetraMessage[] {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => ({
      role: 'user' as const,
      content: uiMessageText(message).slice(0, 8_000),
    }))
    .filter((message) => message.content.trim().length > 0)
    .slice(-10)
}

export function readStoredNetraHistory(raw: string | null): StoredNetraMessage[] {
  if (!raw || raw.length > 200_000) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is StoredNetraMessage => {
      const candidate = record(item)
      return Boolean(candidate)
        && (candidate?.role === 'user' || candidate?.role === 'assistant')
        && typeof candidate?.content === 'string'
        && candidate.content.length > 0
        && candidate.content.length <= 8_000
    }).slice(-20)
  } catch {
    return []
  }
}

export function storedHistoryToUIMessages(
  messages: readonly StoredNetraMessage[],
  scope: 'public' | 'owner',
): UIMessage[] {
  return messages.map((message, index) => ({
    id: `netra-${scope}-${index}`,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  }))
}

export function uiMessagesToStoredHistory(messages: readonly UIMessage[]): StoredNetraMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return []
    const content = uiMessageText(message).slice(0, 8_000)
    return content.trim() ? [{ role: message.role, content }] : []
  }).slice(-20)
}

export function safePublicPermalink(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null

  try {
    const parsed = new URL(value, 'https://worldline.invalid')
    if (parsed.origin !== 'https://worldline.invalid') return null
    const decodedPathname = decodeURIComponent(parsed.pathname)
    if (decodedPathname.includes('\\') || /[\u0000-\u001f\u007f]/.test(decodedPathname)) return null
    if (/^\/(?:api|console|_next)(?:\/|$)/i.test(decodedPathname)) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function traceLink(value: unknown): { title: string; permalink: string } | null {
  const candidate = record(value)
  const permalink = safePublicPermalink(candidate?.permalink)
  if (!candidate || typeof candidate.title !== 'string' || !candidate.title.trim() || !permalink) return null
  return { title: candidate.title.slice(0, 300), permalink }
}

function traceLinks(output: unknown): Array<{ title: string; permalink: string }> {
  if (Array.isArray(output)) {
    return output.map(traceLink).filter((trace): trace is { title: string; permalink: string } => trace !== null)
  }
  const outputRecord = record(output)
  if (!outputRecord) return []
  const nestedTrace = traceLink(outputRecord.trace)
  if (nestedTrace) return [nestedTrace]
  const directTrace = traceLink(outputRecord)
  return directTrace ? [directTrace] : []
}

export function netraToolView(part: UIMessage['parts'][number]): NetraToolView | null {
  if (part.type !== 'dynamic-tool' && !part.type.startsWith('tool-')) return null
  const candidate = record(part)
  if (!candidate || typeof candidate.toolCallId !== 'string' || typeof candidate.state !== 'string') return null
  const allowedStates: NetraToolState[] = [
    'input-streaming',
    'input-available',
    'output-available',
    'output-error',
    'output-denied',
    'approval-requested',
    'approval-responded',
  ]
  if (!allowedStates.includes(candidate.state as NetraToolState)) return null
  const name = part.type === 'dynamic-tool'
    ? String(candidate.toolName ?? 'unknown')
    : part.type.slice('tool-'.length)

  return {
    id: candidate.toolCallId,
    name,
    state: candidate.state as NetraToolState,
    traces: candidate.state === 'output-available' ? traceLinks(candidate.output) : [],
  }
}
