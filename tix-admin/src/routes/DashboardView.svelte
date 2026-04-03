<script lang="ts">
  import { useTickets } from '../lib/data/tickets.svelte'
  import { filterTickets } from '../lib/filter'
  import type { Ticket } from '../lib/types'
  import KanbanBoard from '../lib/components/KanbanBoard.svelte'
  import TicketTable from '../lib/components/TicketTable.svelte'
  import { Button, Input, Select, Dialog } from '../lib/components/ui'

  const store = useTickets()

  let viewMode = $state<'board' | 'table'>('board')
  let search = $state('')
  let statusFilter = $state('')
  let showCreate = $state(false)
  let creating = $state(false)

  // New ticket form
  let newTitle = $state('')
  let newType = $state('task')
  let newPriority = $state(2)
  let newAssignee = $state('')

  const filtered = $derived(filterTickets(store.tickets, {
    search: search || undefined,
    status: statusFilter || undefined,
  }))

  const filteredByStatus = $derived.by(() => {
    const groups: Record<string, Ticket[]> = {
      'open': [],
      'in-progress': [],
      'done': [],
      'closed': [],
    }
    for (const t of filtered) {
      const key = t.status in groups ? t.status : 'open'
      groups[key].push(t)
    }
    return groups
  })

  async function createTicket() {
    if (!newTitle.trim()) return
    creating = true
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          priority: newPriority,
          assignee: newAssignee.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok && data.id) {
        showCreate = false
        newTitle = ''
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
</script>

<div class="flex flex-wrap items-center gap-2 mb-4">
  <h1 class="text-lg font-semibold mr-auto">Tickets</h1>

  <Button size="sm" onclick={() => showCreate = true}>+ New</Button>

  <Input
    type="text"
    placeholder="Search…"
    class="w-48 h-8 text-xs"
    bind:value={search}
  />

  <Select class="w-auto h-8 text-xs" bind:value={statusFilter}>
    <option value="">All statuses</option>
    <option value="open">Open</option>
    <option value="in-progress">In Progress</option>
    <option value="done">Done</option>
    <option value="closed">Closed</option>
  </Select>

  <div class="flex">
    <Button
      variant={viewMode === 'board' ? 'secondary' : 'ghost'}
      size="sm"
      class="rounded-r-none"
      onclick={() => viewMode = 'board'}
    >Board</Button>
    <Button
      variant={viewMode === 'table' ? 'secondary' : 'ghost'}
      size="sm"
      class="rounded-l-none"
      onclick={() => viewMode = 'table'}
    >Table</Button>
  </div>
</div>

<!-- Create ticket dialog -->
<Dialog open={showCreate} onClose={() => showCreate = false}>
  <h3 class="text-lg font-semibold mb-3">New Ticket</h3>
  <form onsubmit={(e) => { e.preventDefault(); createTicket() }}>
    <Input
      type="text"
      placeholder="Title"
      class="mb-2"
      bind:value={newTitle}
      autofocus
    />
    <div class="flex gap-2 mb-2">
      <Select class="flex-1 h-8 text-sm" bind:value={newType}>
        <option value="task">task</option>
        <option value="bug">bug</option>
        <option value="feature">feature</option>
        <option value="epic">epic</option>
      </Select>
      <Select class="flex-1 h-8 text-sm" bind:value={newPriority}>
        <option value={0}>P0</option>
        <option value={1}>P1</option>
        <option value={2}>P2</option>
        <option value={3}>P3</option>
        <option value={4}>P4</option>
      </Select>
    </div>
    <Input
      type="text"
      placeholder="Assignee (optional)"
      class="mb-3 h-8 text-sm"
      bind:value={newAssignee}
    />
    <div class="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onclick={() => showCreate = false}>Cancel</Button>
      <Button type="submit" size="sm" disabled={!newTitle.trim() || creating}>
        {creating ? 'Creating…' : 'Create'}
      </Button>
    </div>
  </form>
</Dialog>

{#if store.loading}
  <div class="flex justify-center py-12">
    <svg class="animate-spin h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </div>
{:else if store.error}
  <div class="rounded-md border border-destructive bg-destructive/10 p-4 flex items-center gap-3">
    <span class="text-sm text-destructive">Failed to load tickets: {store.error}</span>
    <Button variant="outline" size="sm" onclick={() => store.refresh()}>Retry</Button>
  </div>
{:else if store.tickets.length === 0}
  <div class="text-center py-12 text-muted-foreground">
    <p class="text-lg">No tickets found</p>
    <p class="text-sm mt-1">Click <strong>+ New</strong> to create one</p>
  </div>
{:else if filtered.length === 0}
  <div class="text-center py-12 text-muted-foreground">
    <p class="text-lg">No matching tickets</p>
    <p class="text-sm mt-1">Try a different search or filter</p>
  </div>
{:else}
  {#if viewMode === 'board'}
    <KanbanBoard byStatus={filteredByStatus} />
  {:else}
    <TicketTable tickets={filtered} />
  {/if}
{/if}
