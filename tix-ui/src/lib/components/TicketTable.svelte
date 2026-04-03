<script lang="ts">
  import type { Ticket } from '../types'
  import type { GroupBy } from '../data/view-settings.svelte'
  import { Badge } from './ui'
  import StatusIcon from './icons/StatusIcon.svelte'
  import PriorityIcon from './icons/PriorityIcon.svelte'
  import StatusSelector from './StatusSelector.svelte'
  import PrioritySelector from './PrioritySelector.svelte'

  let { tickets, grouped, groupBy, onUpdate }: {
    tickets: Ticket[]
    grouped: Record<string, Ticket[]>
    groupBy: GroupBy
    onUpdate?: (ticketId: string, updates: Record<string, any>) => void
  } = $props()

  const statusColors: Record<string, string> = {
    'open': '#f97316',
    'in-progress': '#facc15',
    'done': '#8b5cf6',
    'closed': '#94a3b8',
  }

  const statusLabels: Record<string, string> = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'done': 'Done',
    'closed': 'Closed',
  }

  const priorityLabels: Record<string, string> = {
    '0': 'P0 Urgent', '1': 'P1 High', '2': 'P2 Medium', '3': 'P3 Low', '4': 'P4 None',
  }

  // Order groups sensibly depending on groupBy
  const orderedGroups = $derived.by(() => {
    const keys = Object.keys(grouped)
    if (groupBy === 'status') {
      const order = ['open', 'in-progress', 'done', 'closed']
      return order.filter(k => keys.includes(k))
    }
    if (groupBy === 'priority') {
      return ['0', '1', '2', '3', '4'].filter(k => keys.includes(k))
    }
    return keys.sort()
  })

  function groupLabel(key: string): string {
    if (groupBy === 'status') return statusLabels[key] || key
    if (groupBy === 'priority') return priorityLabels[key] || `P${key}`
    if (groupBy === 'type') return key.charAt(0).toUpperCase() + key.slice(1)
    return key
  }

  function groupColor(key: string): string {
    if (groupBy === 'status') return statusColors[key] || '#94a3b8'
    return '#94a3b8'
  }
</script>

<div class="w-full">
  {#each orderedGroups as groupKey}
    {#if groupBy !== 'none'}
      <!-- Group header -->
      <div
        class="sticky top-0 z-10 w-full h-10 flex items-center justify-between px-6"
        style="background-color: {groupColor(groupKey)}08"
      >
        <div class="flex items-center gap-2">
          {#if groupBy === 'status'}
            <StatusIcon status={groupKey} />
          {:else if groupBy === 'priority'}
            <PriorityIcon priority={Number(groupKey)} size={14} />
          {/if}
          <span class="text-sm font-medium">{groupLabel(groupKey)}</span>
          <span class="text-sm text-muted-foreground">{grouped[groupKey].length}</span>
        </div>
      </div>
    {/if}

    <!-- Issue rows -->
    {#each grouped[groupKey] as ticket (ticket.id)}
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
