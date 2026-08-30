import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routeSource = readFileSync(
  new URL('../app/api/chat/route.ts', import.meta.url),
  'utf8',
)

test('NETRA accepts the canonical Upstash Redis REST credentials', () => {
  assert.match(routeSource, /process\.env\.UPSTASH_REDIS_REST_URL/)
  assert.match(routeSource, /process\.env\.UPSTASH_REDIS_REST_TOKEN/)
})

test('NETRA accepts the Vercel Upstash integration credential names', () => {
  assert.match(routeSource, /process\.env\.KV_REST_API_URL/)
  assert.match(routeSource, /process\.env\.KV_REST_API_TOKEN/)
})

test('Redis credentials are resolved as matching pairs while production stays fail-closed', () => {
  assert.match(
    routeSource,
    /function resolveRedisCredentials\(\)[\s\S]*?return null\n}/,
  )
  assert.match(
    routeSource,
    /const redisCredentials = resolveRedisCredentials\(\)[\s\S]*?const hasRedis = Boolean\(redisCredentials && ceilingValue\)/,
  )
  assert.match(
    routeSource,
    /if \(!hasRedis\)[\s\S]*?process\.env\.NODE_ENV !== 'production'[\s\S]*?return null/,
  )
})
