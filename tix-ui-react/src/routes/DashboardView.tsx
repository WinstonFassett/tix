import { useState, useMemo, useCallback } from 'react'
import { useTickets, useUpdateTicket, useCreateTicket } from '@/lib/hooks/use-tickets'
import { useFilters, useViewSettings, useSidebar, useCreateDialog } from '@/lib/AppContext'
import { filterTickets } from '@/lib/filter'
import type { Ticket } from '@/lib/types'
import { KanbanBoard } from '@/components/KanbanBoard'
import { TicketTable } from '@/components/TicketTable'
import { MilkdownEditor } from '@/components/MilkdownEditor'
import { StatusSelector } from '@/components/StatusSelector'
import { PrioritySelector } from '@/components/PrioritySelector'
import { TypeSelector } from '@/components/TypeSelector'
import { Button, Input, Select, Dialog, Popover } from '@/components/ui'
import { useNavigate } from '@tanstack/react-router'
import { PanelLeft, Search, Plus, SlidersHorizontal, X, List, LayoutGrid, Loader2 } from 'lucide-react'

export function DashboardView() {
  const navigate = useNavigate()
  const { data: tickets = [], isLoading, error, refetch } = useTickets()
  const updateMutation = useUpdateTicket()
  const createMutation = useCreateTicket()
  const filters = useFilters()
  const view = useViewSettings()
  const { toggle: toggleSidebar } = useSidebar()
  const { showCreate, setShowCreate } = useCreateDialog()

  const [showDisplay, setShowDisplay] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStatus, setNewStatus] = useState('open')
  const [newType, setNewType] = useState('task')
  const [newPriority, setNewPriority] = useState(2)
  const [newAssignee, setNewAssignee] = useState('')
  const [createMore, setCreateMore] = useState(false)

  const filtered = useMemo(() => filterTickets(tickets, {
    status: filters.statusFilter || undefined,
    tag: filters.tagFilter || undefined,
  }), [tickets, filters.statusFilter, filters.tagFilter])

  const sorted = useMemo(() => {
    const dir = view.sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[view.sortBy as keyof Ticket]
      const bv = b[view.sortBy as keyof Ticket]
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [filtered, view.sortBy, view.sortDir])

  const grouped = useMemo(() => {
    if (view.groupBy === 'none') return { '': sorted }
    const groups: Record<string, Ticket[]> = {}
    for (const t of sorted) {
      const key = String(t[view.groupBy as keyof Ticket] ?? '')
      if (!groups[key]) groups[key] = []
      groups[key]!.push(t)
    }
    return groups
  }, [sorted, view.groupBy])

  const filteredByStatus = useMemo(() => {
    const groups: Record<string, Ticket[]> = {
      'open': [], 'in-progress': [], 'on-hold': [], 'done': [], 'closed': [],
    }
    for (const t of sorted) {
      const key = t.status in groups ? t.status : 'open'
      groups[key]!.push(t)
    }
    return groups
  }, [sorted])

  const isDisplayChanged = view.groupBy !== 'status' || view.sortBy !== 'priority' || view.sortDir !== 'asc'

  const handleUpdate = useCallback((ticketId: string, updates: Record<string, any>) => {
    updateMutation.mutate({ ticketId, updates })
  }, [updateMutation])

  async function handleCreate() {
    if (!newTitle.trim()) return
    try {
      const result = await createMutation.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        type: newType,
        priority: newPriority,
        assignee: newAssignee.trim() || undefined,
      })
      setNewTitle('')
      setNewDescription('')
      setNewStatus('open')
      setNewType('task')
      setNewPriority(2)
      setNewAssignee('')
      if (createMore) {
        // Stay in dialog
      } else {
        setShowCreate(false)
        navigate({ to: '/ticket/$ticketId', params: { ticketId: result.id } })
      }
    } catch (e: any) {
      alert(`Failed: ${e.message || 'Unknown error'}`)
    }
  }

  return (
    <>
      {/* Header row 1 */}
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
        <div className="flex items-center gap-1">
          <button className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground" onClick={toggleSidebar} title="Toggle sidebar">
            <PanelLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">All Issues</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Search (⌘K)">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Header row 2 */}
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
        <div className="flex items-center gap-2">
          {(filters.statusFilter || filters.tagFilter) && (
            <>
              <span className="text-xs text-muted-foreground">Filtered by:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium">
                {filters.statusFilter || filters.tagFilter}
                <button className="ml-0.5 hover:text-foreground" onClick={() => filters.clearAll()} aria-label="Clear filter">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Popover
            open={showDisplay}
            onOpenChange={setShowDisplay}
            align="end"
            className="w-56 p-3"
            trigger={
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs gap-1 relative">
                <SlidersHorizontal className="h-4 w-4" />
                Display
                {isDisplayChanged && <span className="absolute -right-0.5 -top-0.5 w-2 h-2 bg-primary rounded-full" />}
              </Button>
            }
          >
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1 block">Group by</span>
                <Select className="h-7 text-xs" value={view.groupBy} onChange={(e) => view.update({ groupBy: e.target.value as any })}>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="type">Type</option>
                  <option value="none">None</option>
                </Select>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1 block">Sort by</span>
                <div className="flex gap-1">
                  <Select className="h-7 text-xs flex-1" value={view.sortBy} onChange={(e) => view.update({ sortBy: e.target.value as any })}>
                    <option value="priority">Priority</option>
                    <option value="title">Title</option>
                    <option value="created">Created</option>
                    <option value="status">Status</option>
                  </Select>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={view.toggleSortDir}>
                    {view.sortDir === 'asc' ? '↑' : '↓'}
                  </Button>
                </div>
              </div>
              <hr className="border-border" />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1 block">View</span>
                <div className="flex gap-1">
                  <Button variant={view.viewMode === 'list' ? 'secondary' : 'outline'} size="sm" className="h-7 px-2 text-xs flex-1 gap-1" onClick={() => view.update({ viewMode: 'list' })}>
                    <List className="h-3.5 w-3.5" /> List
                  </Button>
                  <Button variant={view.viewMode === 'board' ? 'secondary' : 'outline'} size="sm" className="h-7 px-2 text-xs flex-1 gap-1" onClick={() => view.update({ viewMode: 'board' })}>
                    <LayoutGrid className="h-3.5 w-3.5" /> Board
                  </Button>
                </div>
              </div>
            </div>
          </Popover>
        </div>
      </div>

      {/* Create ticket dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} className="sm:max-w-[750px] p-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate() }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
        >
          <button
            type="button"
            className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
            onClick={() => setShowCreate(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="px-4 pt-4 pb-0 space-y-3">
            <input
              type="text"
              className="w-full bg-transparent text-2xl font-medium border-none outline-none placeholder:text-muted-foreground pr-8"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Issue title"
              autoFocus
            />
            <div className="min-h-24">
              <MilkdownEditor onChange={(md) => setNewDescription(md)} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusSelector status={newStatus} onSelect={setNewStatus} />
              <PrioritySelector priority={newPriority} onSelect={setNewPriority} />
              <TypeSelector type={newType} onSelect={setNewType} />
              <Input type="text" placeholder="Assignee" className="w-32 h-7 text-sm" value={newAssignee} onChange={e => setNewAssignee(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5 px-4 border-t mt-3">
            <button
              type="button"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${createMore ? 'bg-primary' : 'bg-input'}`}
              role="switch"
              aria-checked={createMore}
              onClick={() => setCreateMore(!createMore)}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0 transition-transform ${createMore ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-muted-foreground ml-2 mr-auto select-none cursor-pointer" onClick={() => setCreateMore(!createMore)}>Create more</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!newTitle.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create issue'}
                <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">{navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}↵</kbd>
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="mx-6 mt-4 rounded-md border border-destructive bg-destructive/10 p-4 flex items-center gap-3">
            <span className="text-sm text-destructive">Failed to load tickets: {error.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No tickets yet</p>
            <p className="text-sm mt-1">Press <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">+</kbd> to create one</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No matching tickets</p>
          </div>
        ) : view.viewMode === 'list' ? (
          <TicketTable tickets={sorted} grouped={grouped} groupBy={view.groupBy} onUpdate={handleUpdate} />
        ) : (
          <KanbanBoard byStatus={filteredByStatus} />
        )}
      </div>
    </>
  )
}
