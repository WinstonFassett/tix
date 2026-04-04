import { useMemo, useEffect } from 'react'
import { createRouter, createRoute, createRootRoute, RouterProvider, Outlet, useParams, useRouterState, useNavigate } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTickets, useUpdateTicket, useConfig } from '@/lib/hooks/use-tickets'
import { AppProvider, useFilters, useViewSettings, useSidebar, useTheme, useCreateDialog } from '@/lib/AppContext'
import { DashboardView } from '@/routes/DashboardView'
import { TicketView } from '@/routes/TicketView'
import { CommandPalette, type PaletteCallbacks } from '@/components/CommandPalette'
import { StatusIcon } from '@/components/icons/StatusIcon'
import { Button } from '@/components/ui'
import { STATUS_LABELS, type TicketStatus } from '@/lib/types'
import { Sun, Moon, Inbox } from 'lucide-react'

// Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
})

// HMR: refetch tickets on file changes
if (import.meta.hot) {
  import.meta.hot.on('tickets-update', () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
  })
}

function AppLayout() {
  const { data: tickets = [] } = useTickets()
  const updateMutation = useUpdateTicket()
  const { data: config } = useConfig()
  const filters = useFilters()
  const viewSettings = useViewSettings()
  const sidebar = useSidebar()
  const theme = useTheme()
  const { showCreate, setShowCreate } = useCreateDialog()

  const routerState = useRouterState()
  const isTicketView = routerState.location.pathname.startsWith('/ticket/')
  const ticketId = isTicketView ? routerState.location.pathname.split('/ticket/')[1] : undefined
  const currentTicket = ticketId ? tickets.find(t => t.id === ticketId) : undefined

  const ticketsDir = config?.ticketsDir || ''
  const currentFilePath = ticketsDir && currentTicket?.filename ? `${ticketsDir}/${currentTicket.filename}` : ''

  // Document title
  useEffect(() => {
    if (isTicketView && currentTicket) {
      document.title = `tix | ${currentTicket.id} ${currentTicket.title}`
    } else if (filters.statusFilter) {
      document.title = `tix | ${STATUS_LABELS[filters.statusFilter as TicketStatus] ?? filters.statusFilter}`
    } else if (filters.tagFilter) {
      document.title = `tix | #${filters.tagFilter}`
    } else {
      document.title = 'tix | All Issues'
    }
  }, [isTicketView, currentTicket, filters.statusFilter, filters.tagFilter])

  // Tag counts
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tickets) {
      for (const tag of t.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [tickets])

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { open: 0, 'in-progress': 0, 'on-hold': 0, done: 0, closed: 0 }
    for (const t of tickets) {
      if (t.status in counts) counts[t.status]!++
    }
    return counts
  }, [tickets])

  const navigate = useNavigate()

  function toggleStatusFilter(status: string) {
    filters.setTagFilter('')
    filters.setStatusFilter(filters.statusFilter === status ? '' : status)
    if (isTicketView) navigate({ to: '/' })
  }

  function toggleTagFilter(tag: string) {
    filters.setStatusFilter('')
    filters.setTagFilter(filters.tagFilter === tag ? '' : tag)
    if (isTicketView) navigate({ to: '/' })
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

  return (
    <div className="flex h-svh bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebar.open ? 'w-60' : 'w-0'} shrink-0 flex flex-col bg-background transition-[width] duration-200 overflow-hidden lg:py-2`}>
        <div className="flex flex-col px-4 min-w-60 py-2">
          <a href="/" className="text-sm font-semibold font-mono tracking-tight" onClick={(e) => { e.preventDefault(); filters.clearAll(); window.location.hash = '' }}>tix</a>
          {config?.workspaceName && (
            <span className="text-xs text-muted-foreground truncate">{config.workspaceName}</span>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <div className="px-2 mb-1">
            <div
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${!filters.statusFilter && !filters.tagFilter ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
              onClick={() => { filters.clearAll() }}
            >
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span>All Issues</span>
              <span className="ml-auto text-xs text-muted-foreground">{tickets.length}</span>
            </div>
          </div>

          <div className="px-3 mt-4 mb-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
          </div>
          <div className="px-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors ${filters.statusFilter === status ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
                onClick={() => toggleStatusFilter(status)}
              >
                <StatusIcon status={status} size={12} />
                <span>{STATUS_LABELS[status as TicketStatus]}</span>
                <span className="ml-auto text-xs">{count}</span>
              </div>
            ))}
          </div>

          {tagCounts.length > 0 && (
            <>
              <div className="px-3 mt-4 mb-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
              </div>
              <div className="px-2">
                {tagCounts.slice(0, 12).map(([tag, count]) => (
                  <div
                    key={tag}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors ${filters.tagFilter === tag ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
                    onClick={() => toggleTagFilter(tag)}
                  >
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4"/></svg>
                    <span className="truncate">{tag}</span>
                    <span className="ml-auto text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="border-t p-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={theme.toggle}>
            {theme.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 h-svh overflow-hidden lg:p-2">
        <div className="lg:border lg:rounded-md overflow-hidden flex flex-col h-full bg-background">
          <Outlet />
        </div>
      </div>

      <CommandPalette tickets={tickets} callbacks={paletteCallbacks} isTicketView={isTicketView} />
    </div>
  )
}

// Routes
const rootRoute = createRootRoute({
  component: AppLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return <DashboardViewWrapper />
  },
})

const ticketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ticket/$ticketId',
  component: function TicketPage() {
    const { ticketId } = useParams({ from: '/ticket/$ticketId' })
    return <TicketView ticketId={ticketId} />
  },
})

function DashboardViewWrapper() {
  return <DashboardView />
}

const routeTree = rootRoute.addChildren([indexRoute, ticketRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </QueryClientProvider>
  )
}
