import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const routeSource = readFileSync(
  new URL('../app/api/chat/route.ts', import.meta.url),
  'utf8',
)

test('NETRA uses the Vercel AI Gateway free-model runtime without an OpenRouter key', () => {
  assert.doesNotMatch(routeSource, /createOpenRouter|OPENROUTER_API_KEY/)
  assert.match(routeSource, /createNetraGatewayRuntime/)
  assert.match(routeSource, /configuredModel:\s*process\.env\.NETRA_MODEL/)
  assert.match(routeSource, /providerOptions:\s*gatewayRuntime\.providerOptions/)
  assert.equal(
    packageJson.dependencies?.['@openrouter/ai-sdk-provider'],
    undefined,
  )
  assert.equal(
    packageJson.dependencies?.['@ai-sdk/anthropic'],
    undefined,
  )
})

test('Gateway attribution uses the same canonical session ID returned in the cookie', () => {
  assert.match(
    routeSource,
    /createNetraGatewayRuntime\(\{[\s\S]*?sessionId:\s*quotaResult\.sessionId[\s\S]*?\}\)/,
  )
})

test('NETRA accepts the canonical Upstash Redis REST credentials', () => {
  assert.match(routeSource, /process\.env\.UPSTASH_REDIS_REST_URL/)
  assert.match(routeSource, /process\.env\.UPSTASH_REDIS_REST_TOKEN/)
})

test('NETRA accepts the Vercel Upstash integration credential names', () => {
  assert.match(routeSource, /process\.env\.KV_REST_API_URL/)
  assert.match(routeSource, /process\.env\.KV_REST_API_TOKEN/)
})

test('Redis credentials are resolved as matching pairs while Gateway-budgeted deployments keep a local session gate', () => {
  assert.match(
    routeSource,
    /function resolveRedisCredentials\(\)[\s\S]*?return null\n}/,
  )
  assert.match(
    routeSource,
    /if \(!resolveRedisCredentials\(\)\) \{[\s\S]*?const local = checkRateLimit\(sessionId\)/,
  )
  assert.doesNotMatch(routeSource, /WL_DAILY_COST_CEILING|ESTIMATED_REQUEST_COST/)
  assert.doesNotMatch(routeSource, /process\.env\.NODE_ENV !== 'production'/)
})
