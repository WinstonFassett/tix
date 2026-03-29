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
</script>

<div class="flex flex-wrap items-center gap-2 mb-4">
  <h1 class="text-lg font-semibold mr-auto">Tickets</h1>

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
    <p class="text-sm mt-1">Create one with <code class="kbd kbd-sm">tix create</code></p>
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
