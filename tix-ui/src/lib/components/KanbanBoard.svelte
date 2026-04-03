<script lang="ts">
  import type { Ticket } from '../types'
  import TicketCard from './TicketCard.svelte'
  import StatusIcon from './icons/StatusIcon.svelte'

  let { byStatus }: { byStatus: Record<string, Ticket[]> } = $props()

  const columns = ['open', 'in-progress', 'done', 'closed'] as const

  const columnLabels: Record<string, string> = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'done': 'Done',
    'closed': 'Closed',
  }

  const statusColors: Record<string, string> = {
    'open': '#f97316',
    'in-progress': '#facc15',
    'done': '#8b5cf6',
    'closed': '#94a3b8',
  }
</script>

<div class="flex h-full gap-3 px-3 py-3 overflow-x-auto">
  {#each columns as col}
    <div class="shrink-0 w-72 flex flex-col rounded-md overflow-hidden">
      <!-- Column header -->
      <div
        class="h-10 flex items-center justify-between px-3 rounded-t-md"
        style="background-color: {statusColors[col]}10"
      >
        <div class="flex items-center gap-2">
          <StatusIcon status={col} />
          <span class="text-sm font-medium">{columnLabels[col]}</span>
          <span class="text-sm text-muted-foreground">{byStatus[col]?.length || 0}</span>
        </div>
      </div>

      <!-- Cards -->
      <div class="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/30 rounded-b-md">
        {#each byStatus[col] || [] as ticket (ticket.id)}
          <TicketCard {ticket} />
        {/each}
        {#if !byStatus[col]?.length}
          <div class="text-center text-xs text-muted-foreground py-8">No tickets</div>
        {/if}
      </div>
    </div>
  {/each}
</div>
