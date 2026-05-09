/**
 * SPA-safe root for Go server mode. No TanStack Start SSR features.
 * Replaces __root.tsx via Vite alias in go-mode build.
 */
import { useMemo, useEffect, useCallback } from 'react'
import { Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '#/lib/go-client/query-client'
import { AppProvider, useFilters, useViewSettings, useSidebar, useTheme, useCreateDialog, usePalette } from '#/lib/AppContext'
import { useTickets, useUpdateTicket, useConfig } from '#/lib/hooks/use-tickets'
import { TicketDndProvider, useDndState } from '#/lib/DndProvider'
import { useDroppable } from '@dnd-kit/core'
import { CommandPalette, type PaletteCallbacks } from '#/components/CommandPalette'
import { StatusIcon } from '#/components/icons/StatusIcon'
import { TypeIcon } from '#/components/icons/TypeIcon'
import { Button } from '#/components/ui'
import { STATUS_LABELS, TYPE_LABELS, type TicketStatus } from '#/lib/types'
import { Sun, Moon, Inbox, Activity } from 'lucide-react'
import { FolderTree } from '#/components/FolderTree'
import { useChangeHighlight } from '#/components/AnimatedCount'
import { countsByStatus, countsByType, countsByTag, countsByFolder, countRootOnly } from '#/lib/filter'

import './styles.css'


export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </QueryClientProvider>
  )
}

function AppLayout() {
  const { data: tickets = [] } = useTickets()
  const updateMutation = useUpdateTicket()
  const { data: config } = useConfig()
  const filters = useFilters()
  const viewSettings = useViewSettings()
  const sidebar = useSidebar()
  const theme = useTheme()
  const { setShowCreate, showCreate } = useCreateDialog()
  const { setOpen: setPaletteOpen, open: paletteOpen } = usePalette()

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      return false
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (showCreate || paletteOpen) return
      if (isTypingTarget(e.target)) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        setShowCreate(true)
      } else if (e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCreate, paletteOpen, setShowCreate, setPaletteOpen])

  const routerState = useRouterState()
  const isTicketView = routerState.location.pathname.startsWith('/ticket/')
  const ticketId = isTicketView ? routerState.location.pathname.split('/ticket/')[1] : undefined
  const currentTicket = ticketId ? tickets.find(t => t.id === ticketId) : undefined

  const ticketsDir = config?.ticketsDir || ''
  const currentFilePath = ticketsDir && currentTicket?.filename ? `${ticketsDir}/${currentTicket.filename}` : ''

  const titlePrefix = config?.workspaceName || 'tix'
  const isActivityView = routerState.location.pathname === '/activity'
  useEffect(() => {
    if (isTicketView && currentTicket) {
      document.title = `${titlePrefix} | ${currentTicket.id} ${currentTicket.title}`
    } else if (isActivityView) {
      document.title = `${titlePrefix} | Activity`
    } else if (filters.statusFilter) {
      document.title = `${titlePrefix} | ${STATUS_LABELS[filters.statusFilter as TicketStatus] ?? filters.statusFilter}`
    } else if (filters.tagFilter) {
      document.title = `${titlePrefix} | #${filters.tagFilter}`
    } else {
      document.title = `${titlePrefix} | All Issues`
    }
  }, [titlePrefix, isTicketView, isActivityView, currentTicket, filters.statusFilter, filters.tagFilter])

  const activeFilters = useMemo(() => ({
    status: filters.statusFilter || undefined,
    tag: filters.tagFilter || undefined,
    type: filters.typeFilter || undefined,
    folderScope: filters.folderScope || undefined,
  }), [filters.statusFilter, filters.tagFilter, filters.typeFilter, filters.folderScope])

  const statusCounts = useMemo(() => countsByStatus(tickets, activeFilters), [tickets, activeFilters])
  const typeCounts = useMemo(() => countsByType(tickets, activeFilters), [tickets, activeFilters])
  const tagCounts = useMemo(() => countsByTag(tickets, activeFilters), [tickets, activeFilters])
  const folderCounts = useMemo(() => countsByFolder(tickets, activeFilters), [tickets, activeFilters])
  const rootTotalCount = useMemo(() => countRootOnly(tickets, activeFilters), [tickets, activeFilters])

  const navigate = useNavigate()

  function toggleStatusFilter(status: string) {
    const next = filters.statusFilter === status ? undefined : status
    navigate({ to: '/', search: (prev) => ({ ...prev, status: next }) })
  }

  function toggleTagFilter(tag: string) {
    const next = filters.tagFilter === tag ? undefined : tag
    navigate({ to: '/', search: (prev) => ({ ...prev, tag: next }) })
  }

  function toggleTypeFilter(type: string) {
    const next = filters.typeFilter === type ? undefined : type
    navigate({ to: '/', search: (prev) => ({ ...prev, type: next }) })
  }

  function setFolderScope(folder: string) {
    navigate({ to: '/', search: (prev) => ({ ...prev, folder: folder || undefined }) })
  }

  const paletteCallbacks: PaletteCallbacks = {
    toggleTheme: theme.toggle,
    toggleSidebar: sidebar.toggle,
    openCreate: () => setShowCreate(true),
    setViewMode: (m) => viewSettings.update({ viewMode: m }),
    setGroupBy: (g) => viewSettings.update({ groupBy: g }),
    setSortBy: (s) => viewSettings.update({ sortBy: s }),
    toggleSortDir: viewSettings.toggleSortDir,
    ...(currentTicket ? {
      updateTicket: (updates) => updateMutation.mutate({ ticketId: currentTicket.id, updates }),
      copyFilePath: currentFilePath ? () => navigator.clipboard.writeText(currentFilePath) : undefined,
      openInVSCode: currentFilePath ? () => window.open(`vscode://file/${currentFilePath}`) : undefined,
      revealInFinder: ticketsDir ? () => window.open(`vscode://file/${ticketsDir}`) : undefined,
    } : {}),
  }

  function startSidebarDrag(e: React.MouseEvent) {
    if (!sidebar.open) return
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebar.width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function onMove(ev: MouseEvent) {
      sidebar.setWidth(startW + (ev.clientX - startX))
    }
    function onUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleStatusChange = useCallback((ticketId: string, status: string) => {
    updateMutation.mutate({ ticketId, updates: { status } })
  }, [updateMutation])

  const handleTypeChange = useCallback((ticketId: string, type: string) => {
    updateMutation.mutate({ ticketId, updates: { type } })
  }, [updateMutation])

  const handlePriorityChange = useCallback((ticketId: string, priority: number) => {
    updateMutation.mutate({ ticketId, updates: { priority } })
  }, [updateMutation])

  const handleTagAdd = useCallback((ticketId: string, tag: string) => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return
    updateMutation.mutate({ ticketId, updates: { tags: [...ticket.tags, tag] } })
  }, [updateMutation, tickets])

  const handleFolderChange = useCallback((ticketId: string, folder: string) => {
    updateMutation.mutate({ ticketId, updates: { folder } })
  }, [updateMutation])

  return (
    <TicketDndProvider tickets={tickets} onStatusChange={handleStatusChange} onTypeChange={handleTypeChange} onPriorityChange={handlePriorityChange} onTagAdd={handleTagAdd} onFolderChange={handleFolderChange}>
    <div className="flex h-svh bg-background text-foreground overflow-hidden">
      <aside
        className="shrink-0 flex flex-col bg-background overflow-hidden lg:py-2"
        style={{ width: sidebar.open ? `${sidebar.width}px` : 0 }}
      >
        <div className="flex flex-col px-4 py-2" style={{ minWidth: `${sidebar.width}px` }}>
          <a href="/" className="text-sm font-semibold font-mono tracking-tight" onClick={(e) => { e.preventDefault(); navigate({ to: '/', search: {} }) }}>tix</a>
          {config?.workspaceName && (
            <span className="text-xs text-muted-foreground truncate">{config.workspaceName}</span>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <FolderTree
            tickets={tickets}
            folderCounts={folderCounts}
            selectedFolder={filters.folderScope}
            onSelect={setFolderScope}
            totalCount={rootTotalCount}
          />

          <div className="px-2 mt-3 mb-1">
            <div
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${!filters.statusFilter && !filters.tagFilter && !filters.typeFilter ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
              onClick={() => { filters.clearSubFilters(); navigate({ to: '/', search: (prev) => ({ folder: prev.folder }) }) }}
            >
              <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{filters.folderScope ? <>All Issues in{' '}<span className="font-medium whitespace-nowrap">{filters.folderScope}</span></> : 'All Issues'}</span>
            </div>
          </div>

          <div className="px-2 mt-1">
            <div
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${routerState.location.pathname === '/activity' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'}`}
              onClick={() => navigate({ to: '/activity' })}
            >
              <Activity className="h-4 w-4 shrink-0" />
              <span>Activity</span>
            </div>
          </div>

          <div className="px-3 mt-4 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
          </div>
          <div className="px-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <SidebarFacetRow
                key={status}
                count={count}
                active={filters.statusFilter === status}
                onClick={() => toggleStatusFilter(status)}
                icon={<StatusIcon status={status} size={12} />}
                label={STATUS_LABELS[status as TicketStatus]}
                droppableId={`sidebar-status:${status}`}
                dimension="status"
                value={status}
              />
            ))}
          </div>

          <div className="px-3 mt-4 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</span>
          </div>
          <div className="px-2">
            {Object.entries(typeCounts).map(([type, count]) => (
              <SidebarFacetRow
                key={type}
                count={count}
                active={filters.typeFilter === type}
                onClick={() => toggleTypeFilter(type)}
                icon={<TypeIcon type={type} size={12} />}
                label={TYPE_LABELS[type]}
                droppableId={`type:${type}`}
                dimension="type"
                value={type}
              />
            ))}
          </div>

          {tagCounts.length > 0 && (
            <>
              <div className="px-3 mt-4 mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
              </div>
              <div className="px-2">
                {tagCounts.slice(0, 12).map(([tag, count]) => (
                  <SidebarFacetRow
                    key={tag}
                    count={count}
                    active={filters.tagFilter === tag}
                    onClick={() => toggleTagFilter(tag)}
                    icon={<svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4"/></svg>}
                    label={tag}
                    truncateLabel
                    droppableId={`tag:${tag}`}
                    dimension="tag"
                    value={tag}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="px-3 pb-1 flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={theme.toggle}>
            {theme.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {sidebar.open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={startSidebarDrag}
          className="w-1 -mx-0.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10 shrink-0"
        />
      )}

      <div className="flex-1 h-svh overflow-hidden lg:p-2">
        <div className="lg:border lg:rounded-md overflow-hidden flex flex-col h-full bg-background">
          <Outlet />
        </div>
      </div>

      <CommandPalette tickets={tickets} callbacks={paletteCallbacks} isTicketView={isTicketView} />
    </div>
    </TicketDndProvider>
  )
}

function SidebarFacetRow({ count, active, onClick, icon, label, truncateLabel, droppableId, dimension, value }: {
  count: number
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  truncateLabel?: boolean
  droppableId?: string
  dimension?: string
  value?: string
}) {
  const gen = useChangeHighlight(count)
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `_noop_${label}`, disabled: !droppableId })
  const { overTarget } = useDndState()
  const crossHighlight = !isOver && overTarget && dimension && value && overTarget.dimension === dimension && overTarget.value === value

  return (
    <div
      ref={setNodeRef}
      className={`relative flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors ${
        isOver || crossHighlight ? 'bg-primary/15 ring-1 ring-primary/40' :
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
      onClick={onClick}
    >
      {gen > 0 && (
        <div
          key={gen}
          className="absolute inset-0 anim-row-highlight pointer-events-none rounded-md"
        />
      )}
      {icon}
      <span className={truncateLabel ? 'truncate' : ''}>{label}</span>
      <span className="ml-auto text-xs">{count}</span>
    </div>
  )
}
