import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTickets, useUpdateTicket, useCreateTicket } from '#/lib/hooks/use-tickets'
import { useFilters, useViewSettings, useSidebar, useCreateDialog, usePalette, useDetailPanel } from '#/lib/AppContext'
import { TicketDetailPanel } from '#/components/TicketDetailPanel'
import { filterTickets } from '#/lib/filter'
import type { Ticket } from '#/lib/types'
import { KanbanBoard } from '#/components/KanbanBoard'
import { TicketTable } from '#/components/TicketTable'
import { MilkdownEditor } from '#/components/MilkdownEditor'
import { StatusSelector } from '#/components/StatusSelector'
import { PrioritySelector } from '#/components/PrioritySelector'
import { TypeSelector } from '#/components/TypeSelector'
import { Button, Input, Select, Dialog, Popover, PopoverTrigger, PopoverContent } from '#/components/ui'
import { useNavigate } from '@tanstack/react-router'
import { PanelLeft, Search, Plus, SlidersHorizontal, X, List, LayoutGrid, Loader2 } from 'lucide-react'
import { TicketTagsField } from '#/components/TicketTagsField'

export function DashboardView() {
  const navigate = useNavigate()
  const { data: tickets = [], isLoading, error, refetch } = useTickets()
  const updateMutation = useUpdateTicket()
  const createMutation = useCreateTicket()
  const filters = useFilters()
  const view = useViewSettings()
  const { toggle: toggleSidebar } = useSidebar()
  const { showCreate, setShowCreate } = useCreateDialog()
  const { setOpen: setPaletteOpen } = usePalette()
  const { selectedId, setSelectedId } = useDetailPanel()
  const isMac = typeof navigator !== 'undefined' && navigator?.platform?.includes('Mac')

  // Mobile navigation: at narrow viewports route to /ticket/[id] instead of
  // opening the side panel — the back button stays meaningful (7ee2).
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 800px)')
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleRowClick = useCallback((id: string) => {
    if (isNarrow) {
      navigate({ to: '/ticket/$ticketId', params: { ticketId: id } })
    } else {
      setSelectedId(id)
    }
  }, [isNarrow, navigate, setSelectedId])

  const selectedTicket = useMemo(
    () => (selectedId ? tickets.find(t => t.id === selectedId) || null : null),
    [tickets, selectedId],
  )

  const [showDisplay, setShowDisplay] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStatus, setNewStatus] = useState('open')
  const [newType, setNewType] = useState('task')
  const [newPriority, setNewPriority] = useState(2)
  const [newAssignee, setNewAssignee] = useState('')
  const [createMore, setCreateMore] = useState(false)
  const [newTags, setNewTags] = useState<string[]>([])

  const allTagSuggestions = useMemo<string[]>(() => {
    const seen = new Set<string>()
    for (const t of tickets) for (const tag of t.tags) seen.add(tag)
    return Array.from(seen)
  }, [tickets])

  const filtered = useMemo(() => filterTickets(tickets, {
    status: filters.statusFilter || undefined,
    tag: filters.tagFilter || undefined,
    type: filters.typeFilter || undefined,
    folderScope: filters.folderScope || undefined,
  }), [tickets, filters.statusFilter, filters.tagFilter, filters.typeFilter, filters.folderScope])

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
      'open': [], 'in-progress': [], 'review': [], 'on-hold': [], 'done': [], 'closed': [],
    }
    for (const t of sorted) {
      const key = t.status in groups ? t.status : 'open'
      groups[key]!.push(t)
    }
    return groups
  }, [sorted])

  // Flat visible order matching what TicketTable renders: groups walked in
  // canonical order (status / priority / insertion), tickets within each
  // group in their existing sort. Used for arrow-key navigation so the next
  // selection matches what the user actually sees on screen, not the raw
  // sort order (9805).
  const flatVisibleOrder = useMemo<Ticket[]>(() => {
    const keys = Object.keys(grouped)
    let orderedKeys: string[]
    if (view.groupBy === 'status') {
      const order = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed']
      orderedKeys = order.filter(k => keys.includes(k))
    } else if (view.groupBy === 'priority') {
      orderedKeys = ['0', '1', '2', '3', '4'].filter(k => keys.includes(k))
    } else {
      orderedKeys = keys.slice().sort()
    }
    const out: Ticket[] = []
    for (const k of orderedKeys) for (const t of grouped[k] || []) out.push(t)
    return out
  }, [grouped, view.groupBy])

  // Keyboard navigation through the list view: arrow up/down and j/k step
  // through the visible flat order and update the panel selection. First
  // press selects the first row when nothing is selected. Skipped while
  // typing or with modifiers, and disabled on board view / narrow
  // viewports (9805).
  useEffect(() => {
    if (isNarrow) return
    if (view.viewMode !== 'list') return
    function isTyping(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      return false
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target)) return
      const isDown = e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J'
      const isUp = e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K'
      if (!isDown && !isUp) return
      const list = flatVisibleOrder
      if (list.length === 0) return
      e.preventDefault()
      const currentIdx = selectedId ? list.findIndex(t => t.id === selectedId) : -1
      let nextIdx: number
      if (currentIdx === -1) {
        nextIdx = isDown ? 0 : list.length - 1
      } else {
        nextIdx = isDown ? (currentIdx + 1) % list.length : (currentIdx - 1 + list.length) % list.length
      }
      const nextId = list[nextIdx]!.id
      setSelectedId(nextId)
      // Drop the residual focus ring left behind by the previous click —
      // selection is communicated by selectedId / row background, not by
      // browser focus.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-ticket-row="${nextId}"]`) as HTMLElement | null
        if (el) el.scrollIntoView({ block: 'nearest' })
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isNarrow, view.viewMode, flatVisibleOrder, selectedId, setSelectedId])

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
        tags: newTags.length > 0 ? newTags : undefined,
      })
      setNewTitle('')
      setNewDescription('')
      setNewStatus('open')
      setNewType('task')
      setNewPriority(2)
      setNewAssignee('')
      setNewTags([])
      if (createMore) {
        // Stay in dialog
      } else {
        setShowCreate(false)
        if (result.id) {
          // c99a: stay in list view on wide screens and open the new
          // ticket in the side detail panel instead of navigating away.
          // On narrow screens the panel is hidden, so fall back to the
          // full-page ticket route (mirrors handleRowClick).
          if (isNarrow) {
            navigate({ to: '/ticket/$ticketId', params: { ticketId: result.id } })
          } else {
            setSelectedId(result.id)
          }
        }
      }
    } catch (e: any) {
      console.error('[createTicket] failed:', e)
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
          <span className="text-sm font-medium">{filters.folderScope ? `All Issues in ${filters.folderScope}` : 'All Issues'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="h-7 inline-flex items-center gap-2 rounded-md border border-border bg-background hover:bg-accent transition-colors px-2 text-xs text-muted-foreground"
            title="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-1 text-[10px] font-mono bg-muted text-muted-foreground rounded border border-border px-1 py-px">{isMac ? '\u2318K' : 'Ctrl+K'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-7 inline-flex items-center gap-2 rounded-md border border-border bg-background hover:bg-accent transition-colors px-2 text-xs"
            title="Create a new ticket"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
            <kbd className="ml-1 text-[10px] font-mono bg-muted text-muted-foreground rounded border border-border px-1 py-px">C</kbd>
          </button>
        </div>
      </div>

      {/* Header row 2 */}
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
        <div className="flex items-center gap-2 flex-wrap">
          {(filters.statusFilter || filters.tagFilter || filters.typeFilter) && (
            <>
              <span className="text-xs text-muted-foreground">Filtered by:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium">
                {filters.statusFilter || filters.tagFilter || filters.typeFilter}
                <button className="ml-0.5 hover:text-foreground" onClick={() => { filters.clearSubFilters(); navigate({ to: '/', search: {} }) }} aria-label="Clear filter">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Popover open={showDisplay} onOpenChange={setShowDisplay}>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs gap-1 relative">
                <SlidersHorizontal className="h-4 w-4" />
                Display
                {isDisplayChanged && <span className="absolute -right-0.5 -top-0.5 w-2 h-2 bg-primary rounded-full" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3">
              <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1 block">Group by</span>
                <Select className="h-7 text-xs" value={view.groupBy} onChange={(e) => view.update({ groupBy: e.target.value as any })}>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                  <option value="type">Type</option>
                  <option value="folder">Folder</option>
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
                    {view.sortDir === 'asc' ? '\u2191' : '\u2193'}
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
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Create ticket dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} className="sm:max-w-[750px] p-0">
        <form
          className="flex flex-col min-h-0 overflow-hidden"
          onSubmit={(e) => { e.preventDefault(); handleCreate() }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
        >
          <button
            type="button"
            className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground z-10"
            onClick={() => setShowCreate(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="px-4 pt-4 pb-0 space-y-3 overflow-y-auto min-h-0">
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
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground shrink-0 mt-2">Tags</span>
              <div className="flex-1 min-w-0">
                <TicketTagsField
                  value={newTags}
                  onChange={setNewTags}
                  suggestions={allTagSuggestions}
                  placeholder="Add a tag..."
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5 px-4 border-t mt-3 shrink-0">
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
                {createMutation.isPending ? 'Creating...' : 'Create issue'}
                <kbd className="ml-1.5 text-[10px] opacity-60 font-mono">{(typeof navigator !== 'undefined' && navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl') + '\u21B5'}</kbd>
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Content + optional detail panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto min-w-0">
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
            <TicketTable grouped={grouped} groupBy={view.groupBy} onUpdate={handleUpdate} onRowClick={handleRowClick} selectedId={selectedId} />
          ) : (
            <KanbanBoard byStatus={filteredByStatus} onCardClick={handleRowClick} selectedId={selectedId} />
          )}
        </div>
        {selectedTicket && !isNarrow && (
          <TicketDetailPanel key={selectedTicket.id} ticket={selectedTicket} />
        )}
      </div>
    </>
  )
}
