import { useSyncExternalStore, useCallback } from 'react'

const HIGHLIGHT_DURATION_MS = 2500

// Module-level reactive store — shared across all row instances
const highlights = new Map<string, number>()
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

/**
 * Bump the highlight generation for a ticket ID.
 * Call from the WebSocket handler when a ticket changes.
 */
export function bumpHighlight(id: string) {
  highlights.set(id, (highlights.get(id) ?? 0) + 1)
  notify()

  setTimeout(() => {
    highlights.delete(id)
    notify()
  }, HIGHLIGHT_DURATION_MS)
}

/**
 * Subscribe a single row to its highlight generation counter.
 * Returns 0 when not highlighted, >0 when active.
 * Changing the return value forces a re-render of just that row.
 */
export function useRowHighlight(id: string): number {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])
  const getSnapshot = useCallback(() => highlights.get(id) ?? 0, [id])
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
