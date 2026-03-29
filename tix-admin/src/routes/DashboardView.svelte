<script lang="ts">
  import { useTickets } from '../lib/data/tickets.svelte'
  import KanbanBoard from '../lib/components/KanbanBoard.svelte'
  import TicketTable from '../lib/components/TicketTable.svelte'

  const store = useTickets()

  let viewMode = $state<'board' | 'table'>('board')
</script>

<div class="flex items-center justify-between mb-4">
  <h1 class="text-lg font-semibold">Tickets</h1>
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
{:else}
  {#if viewMode === 'board'}
    <KanbanBoard byStatus={store.byStatus} />
  {:else}
    <TicketTable tickets={store.tickets} />
  {/if}
{/if}
