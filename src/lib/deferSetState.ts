// Shared helper for the setTimeout(..., 0) pattern used inside useEffect
// bodies to satisfy react-hooks/set-state-in-effect. Calling setState
// directly in an effect body kicks off an extra render before first paint;
// deferring to the next macrotask lets React flush the current render
// first. The returned `cancel` is meant for the effect's cleanup return,
// and `isCancelled()` lets the deferred callback bail if the effect re-ran
// or unmounted before the timer fired.

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
