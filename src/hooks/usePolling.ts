import { useEffect, useRef } from 'react'

export function usePolling(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback)

  // Always keep the ref pointing to the latest callback to avoid stale closures
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return // Polling disabled (e.g., closed suggestions)

    function tick() {
      // Only fire when tab is visible -- prevents background tab queries
      if (document.visibilityState === 'visible') {
        savedCallback.current()
      }
    }

    const id = setInterval(tick, delay)
    // Cleanup: clear interval on unmount or when delay changes
    return () => clearInterval(id)
  }, [delay])
}
