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

let _settings = $state<ViewSettings>(load())

export function useViewSettings() {
  return {
    get groupBy() { return _settings.groupBy },
    set groupBy(v: GroupBy) { _settings.groupBy = v; persist(_settings) },
    get sortBy() { return _settings.sortBy },
    set sortBy(v: SortBy) { _settings.sortBy = v; persist(_settings) },
    get sortDir() { return _settings.sortDir },
    set sortDir(v: SortDir) { _settings.sortDir = v; persist(_settings) },
    get viewMode() { return _settings.viewMode },
    set viewMode(v: ViewMode) { _settings.viewMode = v; persist(_settings) },
    toggleSortDir() {
      _settings.sortDir = _settings.sortDir === 'asc' ? 'desc' : 'asc'
      persist(_settings)
    },
  }
}
