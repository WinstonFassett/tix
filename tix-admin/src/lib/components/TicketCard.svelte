<script lang="ts">
  import type { Ticket } from '../types'
  import { Badge, Card } from './ui'

  let { ticket }: { ticket: Ticket } = $props()

  type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

  const priorityVariant: Record<number, BadgeVariant> = {
    0: 'destructive',
    1: 'default',
    2: 'secondary',
    3: 'outline',
    4: 'outline',
  }

  const statusVariant: Record<string, BadgeVariant> = {
    'open': 'default',
    'in-progress': 'secondary',
    'done': 'outline',
    'closed': 'outline',
  }
</script>

<a href="#/ticket/{ticket.id}" class="block group">
  <Card class="p-3 transition-colors hover:bg-accent/50">
    <div class="flex items-center gap-2 mb-1">
      <span class="font-mono text-xs text-muted-foreground">{ticket.id}</span>
      <Badge variant={priorityVariant[ticket.priority] ?? 'outline'} class="text-[10px] px-1.5 py-0">P{ticket.priority}</Badge>
    </div>
    <h3 class="text-sm font-medium leading-snug">{ticket.title}</h3>
    <div class="flex items-center gap-1 flex-wrap mt-1.5">
      <Badge variant={statusVariant[ticket.status] ?? 'outline'} class="text-[10px] px-1.5 py-0">{ticket.status}</Badge>
      {#if ticket.assignee}
        <Badge variant="outline" class="text-[10px] px-1.5 py-0">{ticket.assignee}</Badge>
      {/if}
      {#each ticket.tags as tag}
        <Badge variant="outline" class="text-[10px] px-1.5 py-0 opacity-60">{tag}</Badge>
      {/each}
    </div>
    {#if ticket.deps.length > 0}
      <div class="text-xs text-muted-foreground mt-1">deps: {ticket.deps.join(', ')}</div>
    {/if}
  </Card>
</a>
