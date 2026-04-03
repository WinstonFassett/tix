<script lang="ts">
  import type { Ticket } from '../types'
  import TicketCard from './TicketCard.svelte'
  import { Badge } from './ui'

  let { byStatus }: { byStatus: Record<string, Ticket[]> } = $props()

  const columns = ['open', 'in-progress', 'done', 'closed'] as const

  const columnLabels: Record<string, string> = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'done': 'Done',
    'closed': 'Closed',
  }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {#each columns as col}
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 border-b pb-2">
        <h2 class="font-semibold text-sm">{columnLabels[col]}</h2>
        <Badge variant="secondary" class="text-[10px] px-1.5 py-0">{byStatus[col]?.length || 0}</Badge>
      </div>
      <div class="flex flex-col gap-2 min-h-24">
        {#each byStatus[col] || [] as ticket (ticket.id)}
          <TicketCard {ticket} />
        {/each}
        {#if !byStatus[col]?.length}
          <div class="text-center text-sm text-muted-foreground py-8">No tickets</div>
        {/if}
      </div>
    </div>
  {/each}
</div>
