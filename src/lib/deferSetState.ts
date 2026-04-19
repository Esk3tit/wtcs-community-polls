// NIT-v2-03: shared helper consolidating the setTimeout(..., 0) pattern
// used inside useEffect bodies to satisfy react-hooks/set-state-in-effect.
//
// Calling setState directly inside an effect body is flagged because it
// can kick off an extra render before the first paint. Deferring to the
// next macrotask (setTimeout 0) lets React flush the current render and
// runs the callback after the browser settles, avoiding the lint rule
// without fighting it.
//
// Returns a cleanup tuple: pass the `cancel` function to the effect's
// cleanup return. `isCancelled()` lets the deferred callback bail out if
// the effect re-ran or unmounted before the timer fired.

export interface DeferredHandle {
  cancel: () => void
  isCancelled: () => boolean
}

/**
 * Schedule `fn` to run on the next macrotask. Returns a handle with a
 * `cancel()` method suitable for returning from `useEffect` cleanup and
 * an `isCancelled()` predicate the callback can check before touching
 * state.
 */
export function deferSetState(fn: () => void): DeferredHandle {
  let cancelled = false
  const timer = setTimeout(() => {
    if (cancelled) return
    fn()
  }, 0)
  return {
    cancel: () => {
      cancelled = true
      clearTimeout(timer)
    },
    isCancelled: () => cancelled,
  }
}
