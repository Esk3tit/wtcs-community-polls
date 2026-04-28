import { describe, it, expect, vi, beforeEach } from 'vitest'

type StubBreadcrumb = {
  category?: string
  message?: string
  level?: string
  timestamp?: number
  data?: unknown
}

const globalScopeBreadcrumbs: StubBreadcrumb[] = []
const isolationScopeBreadcrumbs: StubBreadcrumb[] = []
const currentScopeBreadcrumbs: StubBreadcrumb[] = []

const makeScope = (bag: StubBreadcrumb[]) => ({
  getScopeData: () => ({ breadcrumbs: bag }),
})

vi.mock('@sentry/react', () => ({
  getGlobalScope: () => makeScope(globalScopeBreadcrumbs),
  getIsolationScope: () => makeScope(isolationScopeBreadcrumbs),
  getCurrentScope: () => makeScope(currentScopeBreadcrumbs),
}))

import { snapshotBreadcrumbs } from '@/components/debug/snapshotBreadcrumbs'

beforeEach(() => {
  globalScopeBreadcrumbs.length = 0
  isolationScopeBreadcrumbs.length = 0
  currentScopeBreadcrumbs.length = 0
})

describe('DebugAuthOverlay snapshotBreadcrumbs', () => {
  it('regression #11: surfaces breadcrumbs added to the isolation scope', () => {
    isolationScopeBreadcrumbs.push({
      category: 'auth',
      message: 'AuthErrorPage rendered',
      level: 'warning',
      timestamp: 1000,
      data: { reason: 'auth-failed' },
    })

    const result = snapshotBreadcrumbs() as StubBreadcrumb[]

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      category: 'auth',
      message: 'AuthErrorPage rendered',
      level: 'warning',
      data: { reason: 'auth-failed' },
    })
  })

  it('merges current + isolation + global, sorts by timestamp ascending, returns the most recent 5', () => {
    globalScopeBreadcrumbs.push({ message: 'global-1', timestamp: 100 })
    isolationScopeBreadcrumbs.push(
      { message: 'iso-2', timestamp: 200 },
      { message: 'iso-3', timestamp: 300 },
      { message: 'iso-4', timestamp: 400 }
    )
    currentScopeBreadcrumbs.push(
      { message: 'cur-5', timestamp: 500 },
      { message: 'cur-6', timestamp: 600 },
      { message: 'cur-7', timestamp: 700 }
    )

    const result = snapshotBreadcrumbs() as StubBreadcrumb[]

    expect(result).toHaveLength(5)
    expect(result.map((b) => b.message)).toEqual([
      'iso-3',
      'iso-4',
      'cur-5',
      'cur-6',
      'cur-7',
    ])
  })

  it('returns an empty array when no breadcrumbs are present in any scope', () => {
    const result = snapshotBreadcrumbs() as StubBreadcrumb[]
    expect(result).toEqual([])
  })
})
