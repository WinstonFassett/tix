import { useEffect, useRef, useState } from 'react'

/**
 * Returns a generation counter that increments when `value` changes.
 * Starts at 0 (no highlight on initial mount), >0 means recently changed.
 * The first change post-mount is suppressed — it's typically the initial
 * data-arrival transition (e.g. count 0 → N when tickets first load) rather
 * than a live update worth animating.
 */
export function useChangeHighlight(value: unknown): number {
  const prevRef = useRef(value)
  const firstChangeSeenRef = useRef(false)
  const [gen, setGen] = useState(0)

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value
      if (!firstChangeSeenRef.current) {
        firstChangeSeenRef.current = true
        return
      }
      setGen(g => g + 1)
    }
  }, [value])

  return gen
}
