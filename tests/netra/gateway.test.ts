import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createNetraGatewayRuntime,
  NETRA_DEFAULT_FREE_GATEWAY_MODEL,
  NETRA_FREE_GATEWAY_MODELS,
} from '../../lib/netra/gateway'

test('NETRA defaults to a zero-priced Gateway model and only falls back to zero-priced models', () => {
  const runtime = createNetraGatewayRuntime({
    configuredModel: undefined,
    sessionId: 'session-default',
  })

  assert.ok(runtime)
  assert.equal(runtime.modelId, NETRA_DEFAULT_FREE_GATEWAY_MODEL)
  assert.equal(runtime.model.modelId, NETRA_DEFAULT_FREE_GATEWAY_MODEL)
  assert.deepEqual(
    runtime.providerOptions.gateway.models,
    NETRA_FREE_GATEWAY_MODELS.filter(
      (model) => model !== NETRA_DEFAULT_FREE_GATEWAY_MODEL,
    ),
  )
  assert.ok(
    [runtime.modelId, ...runtime.providerOptions.gateway.models].every(
      (model) => model.endsWith('-free'),
    ),
  )
})

test('NETRA keeps the fixed M3 then M2.7 order when a vetted fallback model is configured', () => {
  const configuredModel = 'minimax/minimax-m2.7-free'
  const runtime = createNetraGatewayRuntime({
    configuredModel,
    sessionId: 'session-42',
  })

  assert.ok(runtime)
  assert.equal(runtime.modelId, 'minimax/minimax-m3-free')
  assert.deepEqual(runtime.providerOptions.gateway.models, [
    'minimax/minimax-m2.7-free',
  ])
  assert.equal(runtime.providerOptions.gateway.user, 'session-42')
  assert.deepEqual(runtime.providerOptions.gateway.tags, [
    'feature:netra',
    'tier:free-only',
  ])
})

test('NETRA fails closed for paid, unknown, or malformed model overrides', () => {
  for (const configuredModel of [
    'openai/gpt-5.4',
    'minimax/minimax-m3',
    'openrouter/auto',
    ' minimax/minimax-m3-free ',
    '',
  ]) {
    assert.equal(
      createNetraGatewayRuntime({
        configuredModel,
        sessionId: 'session-rejected',
      }),
      null,
      configuredModel,
    )
  }
})
