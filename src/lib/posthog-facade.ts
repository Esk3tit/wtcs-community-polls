// Thin static facade over posthog-js — statically importable so AuthContext
// and ConsentContext can call identify/reset/opt_in_capturing/opt_out_capturing
// synchronously without pulling posthog-js into the critical-path chunk.
//
// Before the lazy PostHog loader resolves its dynamic import, calls are held in
// a bounded FIFO queue and replayed in order the moment setClient() is called.
// The queue cap prevents unbounded growth if the lazy chunk never resolves
// (e.g. a transient CDN failure) — a generous bound relative to the single-digit
// number of identify/reset/opt_* calls a real session makes.

import type posthogType from 'posthog-js'

type Client = typeof posthogType

// Safety valve: queue at most this many deferred calls. Calls beyond the cap
// are silently dropped. Normal sessions will never approach this limit.
const QUEUE_CAP = 50

let client: Client | null = null
const queue: Array<(c: Client) => void> = []

// Routes a call to the client immediately if it is already set; otherwise
// enqueues it up to the cap (dropping silently at cap).
function enqueue(fn: (c: Client) => void): void {
  if (client) {
    fn(client)
    return
  }
  if (queue.length >= QUEUE_CAP) return
  queue.push(fn)
}

export const posthog = {
  identify(id: string): void {
    enqueue((c) => c.identify(id))
  },
  reset(): void {
    enqueue((c) => c.reset())
  },
  opt_in_capturing(): void {
    enqueue((c) => c.opt_in_capturing())
  },
  opt_out_capturing(): void {
    enqueue((c) => c.opt_out_capturing())
  },
  // Called by PostHogProviderInner once the lazy chunk loads: assigns the real
  // client and synchronously drains the queue so no calls are lost.
  setClient(c: Client): void {
    client = c
    while (queue.length) queue.shift()!(c)
  },
}
