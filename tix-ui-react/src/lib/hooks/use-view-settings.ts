import { useState, useCallback } from 'react'

export type GroupBy = 'status' | 'priority' | 'type' | 'none'
export type SortBy = 'priority' | 'title' | 'created' | 'status'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'list' | 'board'

interface ViewSettings {
  groupBy: GroupBy
  sortBy: SortBy
  sortDir: SortDir
  viewMode: ViewMode
}

const STORAGE_KEY = 'tix-view-settings'

const defaults: ViewSettings = {
  groupBy: 'status',
  sortBy: 'priority',
  sortDir: 'asc',
  viewMode: 'list',
}

function load(): ViewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {}
  return { ...defaults }
}

function persist(s: ViewSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function useViewSettings() {
  const [settings, setSettings] = useState<ViewSettings>(load)

  const update = useCallback((patch: Partial<ViewSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const toggleSortDir = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' as SortDir }
      persist(next)
      return next
    })
  }, [])

  return { ...settings, update, toggleSortDir }
}
