/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const submitVoteSource = readFileSync(
  resolve(__dirname, '../../../supabase/functions/submit-vote/index.ts'),
  'utf-8'
)

describe('submit-vote rate limiting behavior (source analysis)', () => {

  describe('rate limit keying', () => {
    it('rate limit key is the authenticated user.id from JWT', () => {
      expect(submitVoteSource).toContain('ratelimit.limit(user.id)')
    })
  })

  describe('rate limit configuration', () => {
    it('uses sliding window with 5 requests per 60 seconds', () => {
      expect(submitVoteSource).toContain("slidingWindow(5, '60 s')")
    })

    it('uses wtcs:vote prefix to namespace rate limit keys', () => {
      expect(submitVoteSource).toContain("prefix: 'wtcs:vote'")
    })
  })

  describe('rate limit position in request flow', () => {
    it('rate limit check occurs after auth but before body parsing', () => {
      const rateLimitLine = submitVoteSource.indexOf('ratelimit.limit(user.id)')
      const bodyParseLine = submitVoteSource.indexOf('req.json()')
      expect(rateLimitLine).toBeGreaterThan(-1)
      expect(bodyParseLine).toBeGreaterThan(-1)
      expect(rateLimitLine).toBeLessThan(bodyParseLine)
    })

    it('rate limit check occurs before guild_member check', () => {
      const rateLimitLine = submitVoteSource.indexOf('ratelimit.limit(user.id)')
      // Search for the actual guild_member DB query, not comments mentioning it
      const guildCheckLine = submitVoteSource.indexOf(".select('guild_member, mfa_verified')")
      expect(rateLimitLine).toBeGreaterThan(-1)
      expect(guildCheckLine).toBeGreaterThan(-1)
      expect(rateLimitLine).toBeLessThan(guildCheckLine)
    })
  })

  describe('fail-closed behavior', () => {
    it('ratelimit.limit is not wrapped in a nested try/catch', () => {
      // Rate limit should be in the main try block, not a nested one
      // Count try blocks before the rate limit call
      const beforeRateLimit = submitVoteSource.substring(
        0, submitVoteSource.indexOf('ratelimit.limit(user.id)')
      )
      const tryCount = (beforeRateLimit.match(/try\s*\{/g) || []).length
      const catchCount = (beforeRateLimit.match(/\}\s*catch/g) || []).length
      // Only one try block open (the outer one), no matching catch before rate limit
      expect(tryCount - catchCount).toBe(1)
    })
  })

  describe('rate limit response format', () => {
    it('rate limited response returns status 429', () => {
      expect(submitVoteSource).toContain('status: 429')
    })

    it('rate limited response body contains D-09 message', () => {
      expect(submitVoteSource).toContain(
        'Too many responses too quickly. Please wait a moment and try again.'
      )
    })

    it('rate limited response includes CORS headers', () => {
      // Find the 429 block and verify corsHeaders is present nearby
      const status429Index = submitVoteSource.indexOf('status: 429')
      const nearbyBlock = submitVoteSource.substring(
        Math.max(0, status429Index - 200), status429Index + 50
      )
      expect(nearbyBlock).toContain('corsHeaders')
    })
  })
})
