<script lang="ts">
  import type { Ticket } from '../types'
  import TicketCard from './TicketCard.svelte'

  let { byStatus }: { byStatus: Record<string, Ticket[]> } = $props()

  const columns = ['open', 'in-progress', 'done', 'closed'] as const

  const columnLabels: Record<string, string> = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'done': 'Done',
    'closed': 'Closed',
  }

  const columnColors: Record<string, string> = {
    'open': 'border-primary',
    'in-progress': 'border-warning',
    'done': 'border-success',
    'closed': 'border-base-300',
  }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {#each columns as col}
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 border-b-2 {columnColors[col]} pb-2">
        <h2 class="font-semibold text-sm">{columnLabels[col]}</h2>
        <span class="badge badge-sm badge-ghost">{byStatus[col]?.length || 0}</span>
      </div>
      <div class="flex flex-col gap-2 min-h-24">
        {#each byStatus[col] || [] as ticket (ticket.id)}
          <TicketCard {ticket} />
        {/each}
        {#if !byStatus[col]?.length}
          <div class="text-center text-sm opacity-30 py-8">No tickets</div>
        {/if}
      </div>
    </div>
  {/each}
</div>
