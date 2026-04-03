<script lang="ts">
  import type { Ticket } from '../types'
  import { Badge } from './ui'
  import StatusIcon from './icons/StatusIcon.svelte'
  import StatusSelector from './StatusSelector.svelte'
  import PrioritySelector from './PrioritySelector.svelte'

  let { tickets, onUpdate }: {
    tickets: Ticket[]
    onUpdate?: (ticketId: string, updates: Record<string, any>) => void
  } = $props()

  const statuses = ['open', 'in-progress', 'done', 'closed']

  const statusColors: Record<string, string> = {
    'open': '#f97316',
    'in-progress': '#facc15',
    'done': '#8b5cf6',
    'closed': '#94a3b8',
  }

  // Group by status
  const grouped = $derived.by(() => {
    const groups: { status: string; label: string; tickets: Ticket[] }[] = []
    for (const s of statuses) {
      const items = tickets.filter(t => t.status === s)
      if (items.length > 0) {
        groups.push({
          status: s,
          label: s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1),
          tickets: items,
        })
      }
    }
    return groups
  })
</script>

<div class="w-full">
  {#each grouped as group}
    <!-- Status group header -->
    <div
      class="sticky top-0 z-10 w-full h-10 flex items-center justify-between px-6"
      style="background-color: {statusColors[group.status]}08"
    >
      <div class="flex items-center gap-2">
        <StatusIcon status={group.status} />
        <span class="text-sm font-medium">{group.label}</span>
        <span class="text-sm text-muted-foreground">{group.tickets.length}</span>
      </div>
    </div>

    <!-- Issue rows -->
    {#each group.tickets as ticket (ticket.id)}
      <div
        class="w-full flex items-center justify-start h-11 px-6 hover:bg-accent/50 cursor-pointer transition-colors"
        onclick={() => location.hash = `#/ticket/${ticket.id}`}
        role="button"
        tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter') location.hash = `#/ticket/${ticket.id}` }}
      >
        <!-- Left: priority selector, id, status selector -->
        <div class="flex items-center gap-0.5 shrink-0">
          <PrioritySelector
            priority={ticket.priority}
            onSelect={(p) => onUpdate?.(ticket.id, { priority: p })}
          />
          <span class="text-sm hidden sm:inline-block text-muted-foreground font-medium w-16 truncate shrink-0 mr-0.5">
            {ticket.id}
          </span>
          <StatusSelector
            status={ticket.status}
            onSelect={(s) => onUpdate?.(ticket.id, { status: s })}
          />
        </div>

        <!-- Title -->
        <span class="min-w-0 flex items-center justify-start mr-1 ml-0.5">
          <span class="text-xs sm:text-sm font-medium sm:font-semibold truncate">
            {ticket.title}
          </span>
        </span>

        <!-- Right: tags, date, assignee -->
        <div class="flex items-center justify-end gap-2 ml-auto shrink-0">
          <div class="w-3 shrink-0"></div>
          <div class="items-center justify-end hidden sm:flex gap-1">
            {#each ticket.tags.slice(0, 3) as tag}
              <Badge variant="outline" class="text-[10px] px-1.5 py-0 rounded-full">{tag}</Badge>
            {/each}
          </div>
          {#if ticket.created}
            <span class="text-xs text-muted-foreground shrink-0 hidden sm:inline-block">
              {new Date(ticket.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          {/if}
          {#if ticket.assignee}
            <span class="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0" title={ticket.assignee}>
              {ticket.assignee.charAt(0).toUpperCase()}
            </span>
          {:else}
            <span class="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 shrink-0"></span>
          {/if}
        </div>
      </div>
    {/each}
  {/each}
</div>
