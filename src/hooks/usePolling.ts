import { useEffect, useRef } from 'react'

export function usePolling(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback)

  // Always keep the ref pointing to the latest callback to avoid stale closures
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return // Polling disabled (e.g., closed suggestions)

    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    async function tick() {
      try {
        // Only fire when tab is visible -- prevents background tab queries
        if (document.visibilityState === 'visible') {
          await savedCallback.current()
        }
      } catch {
        // Swallow callback errors to keep polling alive
      }
      // Schedule next poll only after current one completes (prevents overlap)
      if (!cancelled) {
        timeoutId = setTimeout(tick, delay!)
      }
    }

    timeoutId = setTimeout(tick, delay)
    // Cleanup: cancel pending timeout on unmount or when delay changes
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [delay])
}
