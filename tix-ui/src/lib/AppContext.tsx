import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { GroupBy, SortBy, SortDir, ViewMode } from './types'

// ── Filters ──────────────────────────────────────────────────
interface FiltersState {
  statusFilter: string
  tagFilter: string
  typeFilter: string
  /** Currently scoped folder path. Empty string = root (all). */
  folderScope: string
  setStatusFilter: (v: string) => void
  setTagFilter: (v: string) => void
  setTypeFilter: (v: string) => void
  setFolderScope: (v: string) => void
  /** Clear status/tag/type filters but keep folder scope. */
  clearSubFilters: () => void
  /** Clear everything including folder scope. */
  clearAll: () => void
}

// ── Sidebar ──────────────────────────────────────────────────
interface SidebarState {
  open: boolean
  toggle: () => void
  width: number
  setWidth: (w: number) => void
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

// ── Create Dialog ───────────────────────────────────────────
interface CreateDialogState {
  showCreate: boolean
  setShowCreate: (v: boolean) => void
}

// ── Command Palette ─────────────────────────────────────────
interface PaletteState {
  open: boolean
  setOpen: (v: boolean) => void
}

// ── Detail Panel ────────────────────────────────────────────
interface DetailPanelState {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  width: number
  setWidth: (w: number) => void
}

// ── Combined Context ─────────────────────────────────────────
interface AppContextValue {
  filters: FiltersState
  sidebar: SidebarState
  theme: ThemeState
  viewSettings: ViewSettingsState
  createDialog: CreateDialogState
  palette: PaletteState
  detailPanel: DetailPanelState
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
export function useCreateDialog() { return useAppContext().createDialog }
export function usePalette() { return useAppContext().palette }
export function useDetailPanel() { return useAppContext().detailPanel }

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
  const [typeFilter, setTypeFilter] = useState('')
  const [folderScope, setFolderScope] = useState('')
  const clearSubFilters = useCallback(() => { setStatusFilter(''); setTagFilter(''); setTypeFilter('') }, [])
  const clearAll = useCallback(() => { setStatusFilter(''); setTagFilter(''); setTypeFilter(''); setFolderScope('') }, [])

  // Sidebar — same hydration-safety pattern as view settings: start with the
  // default that the server renders, then sync from localStorage after mount
  // (27ef). Width is also drag-resizable (72a5).
  const SIDEBAR_DEFAULT_WIDTH = 220
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidthState] = useState<number>(SIDEBAR_DEFAULT_WIDTH)
  useEffect(() => {
    setSidebarOpen(localStorage.getItem('tix-sidebar') !== 'collapsed')
    const saved = Number(localStorage.getItem('tix-sidebar-width'))
    if (Number.isFinite(saved) && saved > 160) setSidebarWidthState(saved)
  }, [])
  const setSidebarWidth = useCallback((w: number) => {
    const clamped = Math.max(180, Math.min(480, w))
    setSidebarWidthState(clamped)
    try { localStorage.setItem('tix-sidebar-width', String(clamped)) } catch {}
  }, [])
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev
      localStorage.setItem('tix-sidebar', next ? 'open' : 'collapsed')
      return next
    })
  }, [])

  // Theme — state starts false (matches SSR), synced in useEffect.
  // If the user has never explicitly toggled, fall back to the OS
  // prefers-color-scheme so a fresh browser/port opens in dark when
  // the system is dark (d214). The pre-hydration inline script in
  // __root.tsx applies the same resolution to avoid a flash.
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('tix-theme')
    const prefersDark = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
    const isDark = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])
  const toggleTheme = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('tix-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)

  // Command palette
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelWidth, setPanelWidthState] = useState<number>(() => {
    if (typeof window === 'undefined') return 520
    const saved = Number(localStorage.getItem('tix-detail-panel-width'))
    return Number.isFinite(saved) && saved > 280 ? saved : 520
  })
  const setPanelWidth = useCallback((w: number) => {
    const clamped = Math.max(320, Math.min(900, w))
    setPanelWidthState(clamped)
    try { localStorage.setItem('tix-detail-panel-width', String(clamped)) } catch {}
  }, [])

  // View settings
  // Always start from defaults so the SSR and the first client render match;
  // sync from localStorage in an effect after hydration (27ef).
  const [vs, setVs] = useState<typeof VS_DEFAULTS>(VS_DEFAULTS)
  useEffect(() => {
    setVs(loadVS())
  }, [])
  const updateVS = useCallback((partial: Partial<typeof VS_DEFAULTS>) => {
    setVs((prev: typeof VS_DEFAULTS) => { const next = { ...prev, ...partial }; persistVS(next); return next })
  }, [])
  const toggleSortDir = useCallback(() => {
    setVs((prev: typeof VS_DEFAULTS) => { const next = { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' as const : 'asc' as const }; persistVS(next); return next })
  }, [])

  const value: AppContextValue = {
    filters: { statusFilter, tagFilter, typeFilter, folderScope, setStatusFilter, setTagFilter, setTypeFilter, setFolderScope, clearSubFilters, clearAll },
    sidebar: { open: sidebarOpen, toggle: toggleSidebar, width: sidebarWidth, setWidth: setSidebarWidth },
    theme: { dark, toggle: toggleTheme },
    viewSettings: { ...vs, update: updateVS, toggleSortDir },
    createDialog: { showCreate, setShowCreate },
    palette: { open: paletteOpen, setOpen: setPaletteOpen },
    detailPanel: { selectedId, setSelectedId, width: panelWidth, setWidth: setPanelWidth },
  }

  return <AppContext value={value}>{children}</AppContext>
}
