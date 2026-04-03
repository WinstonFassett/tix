<script lang="ts">
  import type { Ticket } from '../types'
  import { Badge, Card } from './ui'
  import StatusIcon from './icons/StatusIcon.svelte'
  import PriorityIcon from './icons/PriorityIcon.svelte'

  let { ticket }: { ticket: Ticket } = $props()
</script>

<a href="#/ticket/{ticket.id}" class="block group">
  <Card class="p-3 transition-colors hover:bg-accent/50">
    <div class="flex items-center gap-1.5 mb-1">
      <PriorityIcon priority={ticket.priority} size={14} />
      <span class="font-mono text-xs text-muted-foreground">{ticket.id}</span>
      <StatusIcon status={ticket.status} size={12} />
    </div>
    <h3 class="text-sm font-medium leading-snug mb-1.5">{ticket.title}</h3>
    <div class="flex items-center gap-1 flex-wrap">
      {#each ticket.tags as tag}
        <Badge variant="outline" class="text-[10px] px-1.5 py-0 rounded-full">{tag}</Badge>
      {/each}
      {#if ticket.assignee}
        <span class="ml-auto w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium" title={ticket.assignee}>
          {ticket.assignee.charAt(0).toUpperCase()}
        </span>
      {/if}
    </div>
  </Card>
</a>
