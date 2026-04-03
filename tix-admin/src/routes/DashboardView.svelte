<script lang="ts">
  import { useTickets } from '../lib/data/tickets.svelte'
  import { filterTickets } from '../lib/filter'
  import type { Ticket } from '../lib/types'
  import KanbanBoard from '../lib/components/KanbanBoard.svelte'
  import TicketTable from '../lib/components/TicketTable.svelte'

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
        // Navigate to the new ticket
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

  <button class="btn btn-sm btn-primary" onclick={() => showCreate = true}>+ New</button>

  <input
    type="text"
    placeholder="Search…"
    class="input input-sm input-bordered w-48"
    bind:value={search}
  />

  <select class="select select-sm select-bordered" bind:value={statusFilter}>
    <option value="">All statuses</option>
    <option value="open">Open</option>
    <option value="in-progress">In Progress</option>
    <option value="done">Done</option>
    <option value="closed">Closed</option>
  </select>

  <div class="join">
    <button
      class="btn btn-sm join-item"
      class:btn-active={viewMode === 'board'}
      onclick={() => viewMode = 'board'}
    >Board</button>
    <button
      class="btn btn-sm join-item"
      class:btn-active={viewMode === 'table'}
      onclick={() => viewMode = 'table'}
    >Table</button>
  </div>
</div>

<!-- Create ticket modal -->
{#if showCreate}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold mb-3">New Ticket</h3>
      <form onsubmit={(e) => { e.preventDefault(); createTicket() }}>
        <input
          type="text"
          placeholder="Title"
          class="input input-bordered w-full mb-2"
          bind:value={newTitle}
          autofocus
        />
        <div class="flex gap-2 mb-2">
          <select class="select select-bordered select-sm flex-1" bind:value={newType}>
            <option value="task">task</option>
            <option value="bug">bug</option>
            <option value="feature">feature</option>
            <option value="epic">epic</option>
          </select>
          <select class="select select-bordered select-sm flex-1" bind:value={newPriority}>
            <option value={0}>P0</option>
            <option value={1}>P1</option>
            <option value={2}>P2</option>
            <option value={3}>P3</option>
            <option value={4}>P4</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Assignee (optional)"
          class="input input-bordered input-sm w-full mb-3"
          bind:value={newAssignee}
        />
        <div class="modal-action">
          <button type="button" class="btn btn-sm btn-ghost" onclick={() => showCreate = false}>Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary" disabled={!newTitle.trim() || creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
    <div class="modal-backdrop" onclick={() => showCreate = false}></div>
  </div>
{/if}

{#if store.loading}
  <div class="flex justify-center py-12">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{:else if store.error}
  <div class="alert alert-error">
    <span>Failed to load tickets: {store.error}</span>
    <button class="btn btn-sm" onclick={() => store.refresh()}>Retry</button>
  </div>
{:else if store.tickets.length === 0}
  <div class="text-center py-12 opacity-50">
    <p class="text-lg">No tickets found</p>
    <p class="text-sm mt-1">Click <strong>+ New</strong> to create one</p>
  </div>
{:else if filtered.length === 0}
  <div class="text-center py-12 opacity-50">
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
