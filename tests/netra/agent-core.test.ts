import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import {
  NETRA_MAX_MODEL_STEPS,
  NETRA_MAX_OUTPUT_TOKENS,
  NETRA_MAX_PATHNAME_LENGTH,
  runNetraTurn,
  resolveNetraPageContext,
  type NetraKnowledge,
  type NetraPageContext,
  type NetraTrace,
} from '../../lib/netra/index'

const MOCK_USAGE: LanguageModelV3Usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 1,
    text: 1,
    reasoning: 0,
  },
}

type KnowledgeCall = {
  method: keyof NetraKnowledge
  input?: unknown
}

function streamStep(parts: LanguageModelV3StreamPart[]): LanguageModelV3StreamResult {
  return {
    stream: simulateReadableStream({
      chunks: [{ type: 'stream-start', warnings: [] }, ...parts],
      initialDelayInMs: null,
      chunkDelayInMs: null,
    }),
  }
}

function textStep(text: string, id = 'text-1'): LanguageModelV3StreamResult {
  return streamStep([
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: text },
    { type: 'text-end', id },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: undefined },
      usage: MOCK_USAGE,
    },
  ])
}

function toolStep(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>,
): LanguageModelV3StreamResult {
  return streamStep([
    {
      type: 'tool-call',
      toolCallId,
      toolName,
      input: JSON.stringify(input),
    },
    {
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: undefined },
      usage: MOCK_USAGE,
    },
  ])
}

function scriptedModel(steps: LanguageModelV3StreamResult[]) {
  let cursor = 0
  return new MockLanguageModelV3({
    provider: 'offline-netra-test',
    modelId: 'scripted-netra-test',
    doStream: async () => {
      const step = steps[cursor]
      cursor += 1
      assert.ok(step, `unexpected model call ${cursor}`)
      return step
    },
  })
}

function createFakeKnowledge(overrides: Partial<NetraKnowledge> = {}) {
  const calls: KnowledgeCall[] = []
  const knowledge: NetraKnowledge = {
    searchEntries: async (input) => {
      calls.push({ method: 'searchEntries', input })
      return overrides.searchEntries ? overrides.searchEntries(input) : []
    },
    getEntry: async (input) => {
      calls.push({ method: 'getEntry', input })
      return overrides.getEntry ? overrides.getEntry(input) : null
    },
    listRecentPatches: async (input) => {
      calls.push({ method: 'listRecentPatches', input })
      return overrides.listRecentPatches ? overrides.listRecentPatches(input) : []
    },
    searchPhotos: async (input) => {
      calls.push({ method: 'searchPhotos', input })
      return overrides.searchPhotos ? overrides.searchPhotos(input) : []
    },
    listFiction: async () => {
      calls.push({ method: 'listFiction' })
      return overrides.listFiction ? overrides.listFiction() : []
    },
    getCurrentPage: async (page) => {
      calls.push({ method: 'getCurrentPage', input: page })
      return overrides.getCurrentPage ? overrides.getCurrentPage(page) : null
    },
  }

  return { calls, knowledge }
}

function fixtureTrace(overrides: Partial<NetraTrace> = {}): NetraTrace {
  return {
    title: 'fixture title',
    slug: 'fixture',
    lang: 'en',
    summary: 'fixture summary',
    excerpt: 'fixture excerpt',
    permalink: '/articles/fixture',
    ...overrides,
  }
}

function toolResultValue(call: LanguageModelV3CallOptions, toolName: string): unknown {
  for (const message of call.prompt) {
    if (message.role !== 'tool') continue
    for (const part of message.content) {
      if (part.type !== 'tool-result' || part.toolName !== toolName) continue
      assert.equal(part.output.type, 'json')
      if (part.output.type === 'json') return part.output.value
    }
  }
  return assert.fail(`missing ${toolName} result in model prompt`)
}

test('public page resolver normalizes every supported public route family', () => {
  const cases: Array<{
    hint: string
    fallback: 'en' | 'th'
    expected: NetraPageContext
  }> = [
    { hint: '/', fallback: 'en', expected: { kind: 'home', lang: 'en', pathname: '/' } },
    { hint: '/en', fallback: 'th', expected: { kind: 'home', lang: 'en', pathname: '/en' } },
    { hint: '/th/', fallback: 'en', expected: { kind: 'home', lang: 'th', pathname: '/th' } },
    { hint: '/?tour=1#atlas', fallback: 'th', expected: { kind: 'home', lang: 'th', pathname: '/' } },
    { hint: '/archive', fallback: 'en', expected: { kind: 'archive', lang: 'en', pathname: '/archive' } },
    { hint: '/th/archive/', fallback: 'en', expected: { kind: 'archive', lang: 'th', pathname: '/th/archive' } },
    { hint: '/archive?topic=coffee#top', fallback: 'en', expected: { kind: 'archive', lang: 'en', pathname: '/archive' } },
    { hint: '/articles/002', fallback: 'th', expected: { kind: 'article', lang: 'th', pathname: '/articles/002', fileNum: '002' } },
    { hint: '/en/articles/002/', fallback: 'th', expected: { kind: 'article', lang: 'en', pathname: '/en/articles/002', fileNum: '002' } },
    { hint: '/th/articles/999?from=atlas#top', fallback: 'en', expected: { kind: 'article', lang: 'th', pathname: '/th/articles/999', fileNum: '999' } },
    { hint: '/articles/002?ignored=//console', fallback: 'en', expected: { kind: 'article', lang: 'en', pathname: '/articles/002', fileNum: '002' } },
    { hint: '/fiction/transmission-001', fallback: 'en', expected: { kind: 'fiction', lang: 'en', pathname: '/fiction/transmission-001', slug: 'transmission-001' } },
    { hint: '/th/fiction/branch-7/', fallback: 'en', expected: { kind: 'fiction', lang: 'th', pathname: '/th/fiction/branch-7', slug: 'branch-7' } },
    { hint: '/photos', fallback: 'th', expected: { kind: 'photos-index', lang: 'th', pathname: '/photos' } },
    { hint: '/en/photos/?rolls=1#latest', fallback: 'th', expected: { kind: 'photos-index', lang: 'en', pathname: '/en/photos' } },
    { hint: '/photos/2026-05-bangkok', fallback: 'en', expected: { kind: 'photo-roll', lang: 'en', pathname: '/photos/2026-05-bangkok', roll: '2026-05-bangkok' } },
    { hint: '/th/photos/2026-05-bangkok/', fallback: 'en', expected: { kind: 'photo-roll', lang: 'th', pathname: '/th/photos/2026-05-bangkok', roll: '2026-05-bangkok' } },
    { hint: '/photos/2026-05-bangkok/DSCF0002', fallback: 'en', expected: { kind: 'photo-entry', lang: 'en', pathname: '/photos/2026-05-bangkok/DSCF0002', roll: '2026-05-bangkok', id: 'DSCF0002' } },
    { hint: '/en/photos/2026-05-bangkok/DSCF_0002-raw/', fallback: 'th', expected: { kind: 'photo-entry', lang: 'en', pathname: '/en/photos/2026-05-bangkok/DSCF_0002-raw', roll: '2026-05-bangkok', id: 'DSCF_0002-raw' } },
    { hint: '/th/photos/2026-05-bangkok/frame-01?focus=1#meta', fallback: 'en', expected: { kind: 'photo-entry', lang: 'th', pathname: '/th/photos/2026-05-bangkok/frame-01', roll: '2026-05-bangkok', id: 'frame-01' } },
  ]

  for (const { hint, fallback, expected } of cases) {
    assert.deepEqual(resolveNetraPageContext(hint, fallback), expected, hint)
  }
})

test('public page resolver rejects malformed, encoded, oversized, private, and unrecognized hints without retaining raw input', () => {
  const oversized = `/${'x'.repeat(NETRA_MAX_PATHNAME_LENGTH)}`
  const cases: Array<{
    hint: string
    fallback: 'en' | 'th'
    lang: 'en' | 'th'
    reason: 'invalid' | 'private' | 'unrecognized'
  }> = [
    { hint: '', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: 'archive', fallback: 'th', lang: 'th', reason: 'invalid' },
    { hint: ' /archive', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/archive ', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '//archive', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/en//archive', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/archive//', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/articles/%30%30%32', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/articles/002\\console', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/articles/00\u0000', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: oversized, fallback: 'th', lang: 'th', reason: 'invalid' },
    { hint: '/api', fallback: 'en', lang: 'en', reason: 'private' },
    { hint: '/api/chat', fallback: 'en', lang: 'en', reason: 'private' },
    { hint: '/console/editor', fallback: 'en', lang: 'en', reason: 'private' },
    { hint: '/_next/static/chunk.js', fallback: 'en', lang: 'en', reason: 'private' },
    { hint: '/th/api/chat', fallback: 'en', lang: 'th', reason: 'private' },
    { hint: '/en/console/editor', fallback: 'th', lang: 'en', reason: 'private' },
    { hint: '/th/_next/data', fallback: 'en', lang: 'th', reason: 'private' },
    { hint: '/about', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/articles', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/articles/2', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/articles/0002', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/articles/abc', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/articles/002/extra', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/fiction', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/fiction/Transmission-001', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/fiction/transmission--001', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/fiction/transmission-001/extra', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/photos/2026-5-bangkok', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/photos/not-a-roll', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/photos/2026-05-Bangkok', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/photos/2026-05-bangkok/.hidden', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/photos/2026-05-bangkok/frame.1', fallback: 'en', lang: 'en', reason: 'invalid' },
    { hint: '/photos/2026-05-bangkok/frame/extra', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/en/th/archive', fallback: 'en', lang: 'en', reason: 'unrecognized' },
    { hint: '/EN/archive', fallback: 'th', lang: 'th', reason: 'unrecognized' },
  ]

  for (const { hint, fallback, lang, reason } of cases) {
    assert.deepEqual(
      resolveNetraPageContext(hint, fallback),
      { kind: 'unknown', lang, pathname: null, reason },
      hint,
    )
  }
})

test('scripted current-page call uses only normalized fake knowledge and projects a safe trace', async () => {
  const longExcerpt = 'x'.repeat(900)
  const unsafeTrace = {
    ...fixtureTrace({
      title: 'current article',
      slug: '002',
      excerpt: longExcerpt,
      permalink: '/articles/002',
    }),
    body: 'private full body',
    coordinates: { lat: 13.7, lng: 100.5 },
    status: 'draft',
  }
  const fake = createFakeKnowledge({
    getCurrentPage: async () => unsafeTrace,
  })
  const model = scriptedModel([
    toolStep('current-page-1', 'get_current_page', {}),
    textStep('current article · /articles/002', 'current-page-answer'),
  ])

  const result = await runNetraTurn(
    {
      messages: [{ role: 'user', content: 'what is this page about?' }],
      servedLang: 'th',
      page: { pathname: '/en/articles/002/?from=atlas#top' },
    },
    { model, knowledge: fake.knowledge },
  )

  assert.equal(await result.text, 'current article · /articles/002')
  assert.deepEqual(fake.calls, [{
    method: 'getCurrentPage',
    input: {
      kind: 'article',
      lang: 'en',
      pathname: '/en/articles/002',
      fileNum: '002',
    },
  }])
  assert.equal(model.doStreamCalls.length, 2)
  assert.deepEqual(toolResultValue(model.doStreamCalls[1], 'get_current_page'), {
    status: 'resolved',
    page: {
      kind: 'article',
      pathname: '/en/articles/002',
      lang: 'en',
      fileNum: '002',
    },
    trace: {
      title: 'current article',
      slug: '002',
      lang: 'en',
      summary: 'fixture summary',
      excerpt: 'x'.repeat(800),
      permalink: '/articles/002',
    },
  })
})

test('scripted archive search stays bounded and strips fake private fields before the second model call', async () => {
  const unsafeTraces = Array.from({ length: 4 }, (_, index) => ({
    ...fixtureTrace({
      title: `coffee ${index}`,
      slug: `coffee-${index}`,
      excerpt: `${index}`.repeat(900),
      permalink: `/articles/coffee-${index}`,
    }),
    body: `private body ${index}`,
    owner_id: `owner-${index}`,
    latitude: 13.7,
  }))
  const fake = createFakeKnowledge({
    searchEntries: async () => unsafeTraces,
  })
  const model = scriptedModel([
    toolStep('search-1', 'search_entries', {
      query: 'coffee',
      filter: 'articles',
      limit: 2,
    }),
    textStep('two coffee traces surveyed.', 'search-answer'),
  ])

  const result = await runNetraTurn(
    {
      messages: [{ role: 'user', content: 'what does the archive say about coffee?' }],
      servedLang: 'en',
      page: { pathname: '/archive' },
    },
    { model, knowledge: fake.knowledge },
  )

  assert.equal(await result.text, 'two coffee traces surveyed.')
  assert.deepEqual(fake.calls, [{
    method: 'searchEntries',
    input: { query: 'coffee', filter: 'articles', limit: 2 },
  }])
  assert.deepEqual(toolResultValue(model.doStreamCalls[1], 'search_entries'), [
    {
      title: 'coffee 0',
      slug: 'coffee-0',
      lang: 'en',
      summary: 'fixture summary',
      excerpt: '0'.repeat(800),
      permalink: '/articles/coffee-0',
    },
    {
      title: 'coffee 1',
      slug: 'coffee-1',
      lang: 'en',
      summary: 'fixture summary',
      excerpt: '1'.repeat(800),
      permalink: '/articles/coffee-1',
    },
  ])
})

test('offline fake model can answer directly with no tool or live knowledge dependency', async () => {
  const fake = createFakeKnowledge()
  const model = scriptedModel([textStep('archive in view.')])
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
    content: `message-${String(index).padStart(2, '0')}`,
  }))

  const result = await runNetraTurn(
    { messages, servedLang: 'en', page: { pathname: '/en' } },
    { model, knowledge: fake.knowledge },
  )

  assert.equal(await result.text, 'archive in view.')
  assert.deepEqual(fake.calls, [])
  assert.equal(model.provider, 'offline-netra-test')
  assert.equal(model.doStreamCalls.length, 1)
  assert.deepEqual(
    model.doStreamCalls[0].tools?.map((tool) => tool.name),
    [
      'get_current_page',
      'search_entries',
      'get_entry',
      'list_recent_patches',
      'search_photos',
      'list_fiction',
    ],
  )
  assert.deepEqual(model.doStreamCalls[0].toolChoice, { type: 'auto' })

  const rollingPrompt = JSON.stringify(model.doStreamCalls[0].prompt.slice(1))
  assert.doesNotMatch(rollingPrompt, /message-0[01]/)
  for (let index = 2; index < 12; index += 1) {
    assert.match(rollingPrompt, new RegExp(`message-${String(index).padStart(2, '0')}`))
  }
})

test('scripted ambiguous path emits one clarification and performs no retrieval', async () => {
  const fake = createFakeKnowledge()
  const clarification = 'which branch do you mean?'
  const model = scriptedModel([textStep(clarification)])

  const result = await runNetraTurn(
    {
      messages: [{ role: 'user', content: 'tell me about that branch' }],
      servedLang: 'en',
      page: { pathname: '/archive' },
    },
    { model, knowledge: fake.knowledge },
  )

  assert.equal(await result.text, clarification)
  assert.equal(clarification.match(/\?/g)?.length, 1)
  assert.deepEqual(fake.calls, [])
  assert.equal(model.doStreamCalls.length, 1)
})

test('repeated scripted tool calls stop after exactly three model calls', async () => {
  const fake = createFakeKnowledge()
  let callNumber = 0
  const model = new MockLanguageModelV3({
    provider: 'offline-netra-test',
    modelId: 'repeating-tool-test',
    doStream: async () => {
      callNumber += 1
      assert.ok(callNumber <= NETRA_MAX_MODEL_STEPS, 'model exceeded the hard step bound')
      return toolStep(`repeat-${callNumber}`, 'search_entries', {
        query: 'repeat',
        filter: 'all',
        limit: 1,
      })
    },
  })

  const result = await runNetraTurn(
    {
      messages: [{ role: 'user', content: 'keep surveying forever' }],
      servedLang: 'en',
      page: { pathname: '/archive' },
    },
    { model, knowledge: fake.knowledge },
  )

  assert.equal(await result.text, '')
  assert.equal(NETRA_MAX_MODEL_STEPS, 3)
  assert.equal(model.doStreamCalls.length, 3)
  assert.equal(fake.calls.length, 3)
  assert.ok(fake.calls.every((call) => call.method === 'searchEntries'))
})

test('runNetraTurn passes the request abort signal unchanged to the fake model', async () => {
  const controller = new AbortController()
  const fake = createFakeKnowledge()
  const model = scriptedModel([textStep('signal acknowledged.')])

  const result = await runNetraTurn(
    {
      messages: [{ role: 'user', content: 'hello' }],
      servedLang: 'en',
      page: { pathname: '/' },
      abortSignal: controller.signal,
    },
    { model, knowledge: fake.knowledge },
  )

  assert.equal(await result.text, 'signal acknowledged.')
  assert.equal(model.doStreamCalls[0].abortSignal, controller.signal)
  controller.abort('visitor disconnected')
  assert.equal(model.doStreamCalls[0].abortSignal?.aborted, true)
  assert.deepEqual(fake.calls, [])
})

test('runNetraTurn forwards Gateway attribution under a bounded output budget', async () => {
  const fake = createFakeKnowledge()
  const model = scriptedModel([textStep('gateway attributed.')])
  const providerOptions = {
    gateway: {
      user: 'session-42',
      tags: ['feature:netra', 'tier:free-only'],
      models: ['minimax/minimax-m2.7-free'],
    },
  }

  const result = await runNetraTurn(
    {
      messages: [{ role: 'user', content: 'hello' }],
      servedLang: 'en',
      page: { pathname: '/' },
    },
    { model, knowledge: fake.knowledge, providerOptions },
  )

  assert.equal(await result.text, 'gateway attributed.')
  assert.deepEqual(model.doStreamCalls[0].providerOptions, providerOptions)
  assert.equal(model.doStreamCalls[0].maxOutputTokens, NETRA_MAX_OUTPUT_TOKENS)
  assert.equal(NETRA_MAX_OUTPUT_TOKENS, 600)
})
