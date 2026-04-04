import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { GroupBy, SortBy, SortDir, ViewMode } from './types'

// ── Filters ──────────────────────────────────────────────────
interface FiltersState {
  statusFilter: string
  tagFilter: string
  setStatusFilter: (v: string) => void
  setTagFilter: (v: string) => void
  clearAll: () => void
}

// ── Sidebar ──────────────────────────────────────────────────
interface SidebarState {
  open: boolean
  toggle: () => void
}

// ── Theme ────────────────────────────────────────────────────
interface ThemeState {
  dark: boolean
  toggle: () => void
}

// ── View Settings ────────────────────────────────────────────
interface ViewSettingsState {
  groupBy: GroupBy
  sortBy: SortBy
  sortDir: SortDir
  viewMode: ViewMode
  update: (partial: Partial<{ groupBy: GroupBy; sortBy: SortBy; sortDir: SortDir; viewMode: ViewMode }>) => void
  toggleSortDir: () => void
}

// ── Combined Context ─────────────────────────────────────────
interface AppContextValue {
  filters: FiltersState
  sidebar: SidebarState
  theme: ThemeState
  viewSettings: ViewSettingsState
}

const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

// Convenience re-exports
export function useFilters() { return useAppContext().filters }
export function useSidebar() { return useAppContext().sidebar }
export function useTheme() { return useAppContext().theme }
export function useViewSettings() { return useAppContext().viewSettings }

// ── View Settings persistence ────────────────────────────────
const VS_KEY = 'tix-view-settings'
const VS_DEFAULTS = { groupBy: 'status' as GroupBy, sortBy: 'priority' as SortBy, sortDir: 'asc' as SortDir, viewMode: 'list' as ViewMode }

function loadVS() {
  try {
    const raw = localStorage.getItem(VS_KEY)
    if (raw) return { ...VS_DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...VS_DEFAULTS }
}
function persistVS(s: typeof VS_DEFAULTS) {
  localStorage.setItem(VS_KEY, JSON.stringify(s))
}

// ── Provider ─────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const clearAll = useCallback(() => { setStatusFilter(''); setTagFilter('') }, [])

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('tix-sidebar') !== 'collapsed')
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev
      localStorage.setItem('tix-sidebar', next ? 'open' : 'collapsed')
      return next
    })
  }, [])

  // Theme
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('tix-theme') === 'dark'
    if (saved) document.documentElement.classList.add('dark')
    return saved
  })
  const toggleTheme = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('tix-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  // View settings
  const [vs, setVs] = useState<typeof VS_DEFAULTS>(loadVS)
  const updateVS = useCallback((partial: Partial<typeof VS_DEFAULTS>) => {
    setVs((prev: typeof VS_DEFAULTS) => { const next = { ...prev, ...partial }; persistVS(next); return next })
  }, [])
  const toggleSortDir = useCallback(() => {
    setVs((prev: typeof VS_DEFAULTS) => { const next = { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' as const : 'asc' as const }; persistVS(next); return next })
  }, [])

  const value: AppContextValue = {
    filters: { statusFilter, tagFilter, setStatusFilter, setTagFilter, clearAll },
    sidebar: { open: sidebarOpen, toggle: toggleSidebar },
    theme: { dark, toggle: toggleTheme },
    viewSettings: { ...vs, update: updateVS, toggleSortDir },
  }

  return <AppContext value={value}>{children}</AppContext>
}
