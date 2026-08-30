import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkRateLimit,
  RATE_LIMIT_MAX_SESSIONS,
} from '../../lib/server/rate-limit'

test('local quota fallback evicts its oldest record at the hard capacity', () => {
  assert.equal(Number.isInteger(RATE_LIMIT_MAX_SESSIONS), true)
  assert.ok(RATE_LIMIT_MAX_SESSIONS >= 2)

  const issuedSessionIds: string[] = []
  for (let index = 0; index <= RATE_LIMIT_MAX_SESSIONS; index += 1) {
    const result = checkRateLimit(undefined)
    assert.equal(result.allowed, true)
    issuedSessionIds.push(result.sessionId)
  }

  const recycled = checkRateLimit(issuedSessionIds[0])
  assert.equal(recycled.allowed, true)
  assert.equal(recycled.isNew, true)
  assert.equal(recycled.remaining, 49)
})
