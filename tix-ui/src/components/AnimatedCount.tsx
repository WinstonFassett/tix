import { useEffect, useRef, useState } from 'react'

/**
 * Returns a generation counter that increments when `value` changes.
 * Starts at 0 (no highlight on initial mount), >0 means recently changed.
 */
export function useChangeHighlight(value: unknown): number {
  const prevRef = useRef(value)
  const [gen, setGen] = useState(0)

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value
      setGen(g => g + 1)
    }
  }, [value])

  return gen
}
