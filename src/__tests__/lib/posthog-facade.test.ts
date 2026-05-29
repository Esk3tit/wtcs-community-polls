import { describe, it, expect, vi, beforeEach } from 'vitest'

// Builds a stub client that mirrors the four methods the facade forwards to.
// The facade calls these methods directly when the client is set, so each spy
// gives us a clear signal that a forwarded call actually reached the client.
function makeStub() {
  return {
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  }
}

// Each test re-imports the facade fresh so module-scope state (queue + client)
// resets cleanly between tests — required because the facade's queue and client
// reference live at module scope and would leak across tests otherwise.
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('posthog-facade', () => {
  it('queues identify + reset before setClient, then flushes on setClient', async () => {
    const { posthog } = await import('@/lib/posthog-facade')
    const spy = makeStub()

    // Before setClient: calls must be queued, not forwarded.
    posthog.identify('user-1')
    posthog.reset()
    expect(spy.identify).not.toHaveBeenCalled()
    expect(spy.reset).not.toHaveBeenCalled()

    // setClient bridges the facade to the real client and drains the queue.
    posthog.setClient(spy as never)
    expect(spy.identify).toHaveBeenCalledTimes(1)
    expect(spy.identify).toHaveBeenCalledWith('user-1')
    expect(spy.reset).toHaveBeenCalledTimes(1)
  })

  it('forwards identify directly when client is already set (no queuing)', async () => {
    const { posthog } = await import('@/lib/posthog-facade')
    const spy = makeStub()

    // Client already attached — subsequent calls must forward synchronously.
    posthog.setClient(spy as never)
    posthog.identify('user-2')
    expect(spy.identify).toHaveBeenCalledTimes(1)
    expect(spy.identify).toHaveBeenCalledWith('user-2')
  })

  it('forwards opt_in_capturing and opt_out_capturing after setClient', async () => {
    const { posthog } = await import('@/lib/posthog-facade')
    const spy = makeStub()

    posthog.setClient(spy as never)
    posthog.opt_in_capturing()
    posthog.opt_out_capturing()
    expect(spy.opt_in_capturing).toHaveBeenCalledTimes(1)
    expect(spy.opt_out_capturing).toHaveBeenCalledTimes(1)
  })

  it('caps queue at QUEUE_CAP — drops additional calls rather than growing unboundedly', async () => {
    // Guards against unbounded queue growth when the lazy chunk never resolves
    // (e.g. transient CDN failure): the queue must stop growing at the cap.
    const { posthog } = await import('@/lib/posthog-facade')
    const QUEUE_CAP = 50

    // Exceed the cap — all calls should silently drop beyond QUEUE_CAP.
    for (let i = 0; i < QUEUE_CAP + 20; i++) {
      posthog.identify(`user-${i}`)
    }

    // Now set the client — the flushed calls must equal exactly QUEUE_CAP.
    const spy = makeStub()
    posthog.setClient(spy as never)
    expect(spy.identify).toHaveBeenCalledTimes(QUEUE_CAP)
  })
})
