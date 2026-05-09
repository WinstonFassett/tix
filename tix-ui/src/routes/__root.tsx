import { useMemo, useEffect, useCallback } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '#/lib/query-client'
import { AppProvider, useFilters, useViewSettings, useSidebar, useTheme, useCreateDialog, usePalette } from '#/lib/AppContext'
import { useTickets, useUpdateTicket, useConfig } from '#/lib/hooks/use-tickets'
import { TicketDndProvider } from '#/lib/DndProvider'
import { CommandPalette, type PaletteCallbacks } from '#/components/CommandPalette'
import { AppSidebar } from '#/components/AppSidebar'
import { STATUS_LABELS, type TicketStatus } from '#/lib/types'
import { countsByStatus, countsByType, countsByTag, countsByFolder, countRootOnly } from '#/lib/filter'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'tix' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: `try{var s=localStorage.getItem('tix-theme');var d=s?s==='dark':window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

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
  useEffect(() => {
    if (isTicketView && currentTicket) {
      document.title = `${titlePrefix} | ${currentTicket.id} ${currentTicket.title}`
    } else if (filters.statusFilter) {
      document.title = `${titlePrefix} | ${STATUS_LABELS[filters.statusFilter as TicketStatus] ?? filters.statusFilter}`
    } else if (filters.tagFilter) {
      document.title = `${titlePrefix} | #${filters.tagFilter}`
    } else {
      document.title = `${titlePrefix} | All Issues`
    }
  }, [titlePrefix, isTicketView, currentTicket, filters.statusFilter, filters.tagFilter])

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

  return (
    <TicketDndProvider tickets={tickets} onStatusChange={handleStatusChange} onTypeChange={handleTypeChange} onPriorityChange={handlePriorityChange} onTagAdd={handleTagAdd} onFolderChange={handleFolderChange}>
      <div className="flex h-svh bg-background text-foreground overflow-hidden">
        <AppSidebar
          tickets={tickets}
          workspaceName={config?.workspaceName}
          statusCounts={statusCounts}
          typeCounts={typeCounts}
          tagCounts={tagCounts}
          folderCounts={folderCounts}
          rootTotalCount={rootTotalCount}
          onSidebarDragStart={startSidebarDrag}
        />
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
