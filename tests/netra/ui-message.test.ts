import assert from 'node:assert/strict'
import test from 'node:test'
import type { UIMessage } from 'ai'
import {
  netraToolView,
  plainNetraText,
  safePublicPermalink,
  userMessagesForRequest,
} from '../../lib/netra/ui-message'

function textMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] }
}

test('the UI transport sends only the latest ten visitor-authored messages', () => {
  const messages: UIMessage[] = []
  for (let index = 0; index < 12; index += 1) {
    messages.push(textMessage(`u-${index}`, 'user', `user-${index}`))
    messages.push(textMessage(`a-${index}`, 'assistant', `assistant-${index}`))
  }

  assert.deepEqual(userMessagesForRequest(messages),
    Array.from({ length: 10 }, (_, index) => ({
      role: 'user' as const,
      content: `user-${index + 2}`,
    })),
  )
})

test('tool telemetry exposes only projected traces and safe same-site permalinks', () => {
  const part = {
    type: 'tool-list_places',
    toolCallId: 'places-1',
    state: 'output-available',
    input: {},
    output: [{
      title: 'Bangkok · TH',
      slug: 'bangkok',
      lang: 'en',
      summary: 'surveyed place',
      excerpt: 'surveyed place',
      permalink: '/#hero',
      coordinates: { lat: 13.7, lon: 100.5 },
    }],
  } as unknown as UIMessage['parts'][number]

  assert.deepEqual(netraToolView(part), {
    id: 'places-1',
    name: 'list_places',
    state: 'output-available',
    traces: [{ title: 'Bangkok · TH', permalink: '/#hero' }],
  })
})

test('permalink rendering rejects external, private, encoded-private, and malformed targets', () => {
  assert.equal(safePublicPermalink('/articles/002?from=netra#top'), '/articles/002?from=netra#top')
  for (const value of [
    'https://attacker.invalid/steal',
    '//attacker.invalid/steal',
    '/console/editor',
    '/%63onsole/editor',
    '/api/chat',
    '/_next/static/file.js',
    '/articles/002\\evil',
  ]) {
    assert.equal(safePublicPermalink(value), null, value)
  }
})

test('assistant transcript text normalizes model formatting into safe plain text', () => {
  assert.equal(
    plainNetraText('## shelves\n* **atlas** — surveyed\n* _fiction_ — intercepted\n`archive`'),
    'shelves\n- atlas — surveyed\n- fiction — intercepted\narchive',
  )
  assert.equal(
    plainNetraText('[open the archive](/en/archive) and <strong>survey</strong>'),
    'open the archive (/en/archive) and survey',
  )
})
