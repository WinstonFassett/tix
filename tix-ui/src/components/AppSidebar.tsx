import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useFilters, useSidebar, useTheme } from '#/lib/AppContext'
import { Button } from '#/components/ui'
import { STATUS_LABELS, TYPE_LABELS, type Ticket, type TicketStatus } from '#/lib/types'
import { Sun, Moon, Inbox, Activity } from 'lucide-react'
import { FolderTree } from '#/components/FolderTree'
import { StatusIcon } from '#/components/icons/StatusIcon'
import { TypeIcon } from '#/components/icons/TypeIcon'
import { SidebarFacetRow } from '#/components/SidebarFacetRow'

interface AppSidebarProps {
  tickets: Ticket[]
  workspaceName?: string
  statusCounts: Record<string, number>
  typeCounts: Record<string, number>
  tagCounts: [string, number][]
  folderCounts: Map<string, number>
  rootTotalCount: number
  onSidebarDragStart: (e: React.MouseEvent) => void
}

export function AppSidebar({
  tickets,
  workspaceName,
  statusCounts,
  typeCounts,
  tagCounts,
  folderCounts,
  rootTotalCount,
  onSidebarDragStart,
}: AppSidebarProps) {
  const filters = useFilters()
  const sidebar = useSidebar()
  const theme = useTheme()
  const navigate = useNavigate()
  const routerState = useRouterState()

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

  return (
    <>
      <aside
        className="shrink-0 flex flex-col bg-background overflow-hidden lg:py-2"
        style={{ width: sidebar.open ? `${sidebar.width}px` : 0 }}
      >
        <div className="flex flex-col px-4 py-2" style={{ minWidth: `${sidebar.width}px` }}>
          <a href="/" className="text-sm font-semibold font-mono tracking-tight" onClick={(e) => { e.preventDefault(); navigate({ to: '/', search: {} }) }}>tix</a>
          {workspaceName && (
            <span className="text-xs text-muted-foreground truncate">{workspaceName}</span>
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
          onMouseDown={onSidebarDragStart}
          className="w-1 -mx-0.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10 shrink-0"
        />
      )}
    </>
  )
}
