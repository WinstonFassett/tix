<script lang="ts">
  import { useTickets } from '../lib/data/tickets.svelte'
  import { useFilters } from '../lib/data/filters.svelte'
  import { useViewSettings } from '../lib/data/view-settings.svelte'
  import { filterTickets } from '../lib/filter'
  import type { Ticket } from '../lib/types'
  import KanbanBoard from '../lib/components/KanbanBoard.svelte'
  import TicketTable from '../lib/components/TicketTable.svelte'
  import { Button, Input, Select, Dialog, Popover } from '../lib/components/ui'
  import MilkdownEditor from '../lib/components/MilkdownEditor.svelte'

  const store = useTickets()
  const filters = useFilters()
  const view = useViewSettings()

  let search = $state('')
  let showCreate = $state(false)
  let showSearch = $state(false)
  let showDisplay = $state(false)
  let creating = $state(false)

  // New ticket form
  let newTitle = $state('')
  let newDescription = $state('')
  let newType = $state('task')
  let newPriority = $state(2)
  let newAssignee = $state('')

  const filtered = $derived(filterTickets(store.tickets, {
    search: search || undefined,
    status: filters.statusFilter || undefined,
    tag: filters.tagFilter || undefined,
  }))

  const sorted = $derived.by(() => {
    const dir = view.sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[view.sortBy]
      const bv = b[view.sortBy]
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  })

  const grouped = $derived.by(() => {
    if (view.groupBy === 'none') return { '': sorted }
    const groups: Record<string, Ticket[]> = {}
    for (const t of sorted) {
      const key = String(t[view.groupBy] ?? '')
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }
    return groups
  })

  const filteredByStatus = $derived.by(() => {
    const groups: Record<string, Ticket[]> = {
      'open': [], 'in-progress': [], 'on-hold': [], 'done': [], 'closed': [],
    }
    for (const t of sorted) {
      const key = t.status in groups ? t.status : 'open'
      groups[key].push(t)
    }
    return groups
  })

  const isDisplayChanged = $derived(
    view.groupBy !== 'status' || view.sortBy !== 'priority' || view.sortDir !== 'asc'
  )

  async function createTicket() {
    if (!newTitle.trim()) return
    creating = true
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          type: newType,
          priority: newPriority,
          assignee: newAssignee.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok && data.id) {
        showCreate = false
        newTitle = ''
        newDescription = ''
        newType = 'task'
        newPriority = 2
        newAssignee = ''
        location.hash = `#/ticket/${data.id}`
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally {
      creating = false
    }
  }

  async function updateTicket(ticketId: string, updates: Record<string, any>) {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Save failed:', data.error)
    }
  }

  function toggleSearch() {
    showSearch = !showSearch
    if (!showSearch) search = ''
  }

  function focus(node: HTMLElement) { node.focus() }
</script>

<!-- Header row 1: nav -->
<div class="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
  <span class="text-sm font-medium">All Issues</span>
  <div class="flex items-center gap-1">
    {#if showSearch}
      <div class="relative flex items-center w-64 transition-all duration-200">
        <svg class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <Input
          type="search"
          placeholder="Search issues..."
          class="pl-8 h-7 text-sm"
          bind:value={search}
          autofocus
          onkeydown={(e) => { if (e.key === 'Escape') { if (!search) toggleSearch(); else search = '' } }}
        />
      </div>
    {:else}
      <Button variant="ghost" size="icon" class="h-8 w-8" onclick={toggleSearch}>
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </Button>
    {/if}
    <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => showCreate = true}>
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </Button>
  </div>
</div>

<!-- Header row 2: options -->
<div class="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
  <div class="flex items-center gap-2">
    {#if filters.statusFilter || filters.tagFilter}
      <span class="text-xs text-muted-foreground">Filtered by:</span>
      <span class="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium">
        {filters.statusFilter || filters.tagFilter}
        <button class="ml-0.5 hover:text-foreground" onclick={() => filters.clearAll()} aria-label="Clear filter">
          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>
    {/if}
  </div>

  <div class="flex items-center gap-1">
    <!-- Display settings popover -->
    <Popover bind:open={showDisplay} align="end" class="w-56 p-3">
      {#snippet trigger()}
        <Button variant="secondary" size="sm" class="h-7 px-2 text-xs gap-1 relative">
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg>
          Display
          {#if isDisplayChanged}
            <span class="absolute -right-0.5 -top-0.5 w-2 h-2 bg-primary rounded-full"></span>
          {/if}
        </Button>
      {/snippet}

      <div class="space-y-3">
        <div>
          <span class="text-xs font-medium text-muted-foreground mb-1 block">Group by</span>
          <Select class="h-7 text-xs" value={view.groupBy} onchange={(e) => view.groupBy = (e.target as HTMLSelectElement).value as any}>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="type">Type</option>
            <option value="none">None</option>
          </Select>
        </div>
        <div>
          <span class="text-xs font-medium text-muted-foreground mb-1 block">Sort by</span>
          <div class="flex gap-1">
            <Select class="h-7 text-xs flex-1" value={view.sortBy} onchange={(e) => view.sortBy = (e.target as HTMLSelectElement).value as any}>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
              <option value="created">Created</option>
              <option value="status">Status</option>
            </Select>
            <Button variant="outline" size="sm" class="h-7 px-2 text-xs shrink-0" onclick={() => view.toggleSortDir()}>
              {view.sortDir === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>
        <hr class="border-border" />
        <div>
          <span class="text-xs font-medium text-muted-foreground mb-1 block">View</span>
          <div class="flex gap-1">
            <Button
              variant={view.viewMode === 'list' ? 'secondary' : 'outline'}
              size="sm"
              class="h-7 px-2 text-xs flex-1 gap-1"
              onclick={() => view.viewMode = 'list'}
            >
              <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              List
            </Button>
            <Button
              variant={view.viewMode === 'board' ? 'secondary' : 'outline'}
              size="sm"
              class="h-7 px-2 text-xs flex-1 gap-1"
              onclick={() => view.viewMode = 'board'}
            >
              <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Board
            </Button>
          </div>
        </div>
      </div>
    </Popover>
  </div>
</div>

<!-- Create ticket dialog -->
<Dialog open={showCreate} onClose={() => showCreate = false} class="sm:max-w-150">
  <h3 class="text-lg font-semibold mb-4">New Ticket</h3>
  <form onsubmit={(e) => { e.preventDefault(); createTicket() }}>
    <input
      type="text"
      class="w-full bg-transparent text-xl font-medium border-none outline-none placeholder:text-muted-foreground mb-2"
      bind:value={newTitle}
      placeholder="Issue title"
      use:focus
    />
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <Select class="w-auto h-8 text-sm" bind:value={newType}>
        <option value="task">Task</option>
        <option value="bug">Bug</option>
        <option value="feature">Feature</option>
        <option value="epic">Epic</option>
      </Select>
      <Select class="w-auto h-8 text-sm" bind:value={newPriority}>
        <option value={0}>P0 Urgent</option>
        <option value={1}>P1 High</option>
        <option value={2}>P2 Medium</option>
        <option value={3}>P3 Low</option>
        <option value={4}>P4 None</option>
      </Select>
      <Input
        type="text"
        placeholder="Assignee (optional)"
        class="w-40 h-8 text-sm"
        bind:value={newAssignee}
      />
    </div>
    <div class="min-h-32 mb-4">
      <MilkdownEditor onChange={(md) => newDescription = md} />
    </div>
    <div class="flex justify-end gap-2 border-t pt-3">
      <Button type="button" variant="ghost" size="sm" onclick={() => showCreate = false}>Cancel</Button>
      <Button type="submit" size="sm" disabled={!newTitle.trim() || creating}>
        {creating ? 'Creating…' : 'Create issue'}
      </Button>
    </div>
  </form>
</Dialog>

<!-- Content -->
<div class="flex-1 overflow-auto">
  {#if store.loading}
    <div class="flex justify-center py-12">
      <svg class="animate-spin h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>
  {:else if store.error}
    <div class="mx-6 mt-4 rounded-md border border-destructive bg-destructive/10 p-4 flex items-center gap-3">
      <span class="text-sm text-destructive">Failed to load tickets: {store.error}</span>
      <Button variant="outline" size="sm" onclick={() => store.refresh()}>Retry</Button>
    </div>
  {:else if store.tickets.length === 0}
    <div class="text-center py-16 text-muted-foreground">
      <p class="text-lg">No tickets yet</p>
      <p class="text-sm mt-1">Press <kbd class="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">+</kbd> to create one</p>
    </div>
  {:else if filtered.length === 0}
    <div class="text-center py-16 text-muted-foreground">
      <p>No matching tickets</p>
    </div>
  {:else if view.viewMode === 'list'}
    <TicketTable tickets={sorted} {grouped} groupBy={view.groupBy} onUpdate={updateTicket} />
  {:else}
    <KanbanBoard byStatus={filteredByStatus} />
  {/if}
</div>
