<script lang="ts">
  import type { Ticket } from '../types'

  let { ticket }: { ticket: Ticket } = $props()

  const priorityBadge: Record<number, string> = {
    0: 'badge-error',
    1: 'badge-warning',
    2: 'badge-info',
    3: 'badge-ghost',
    4: 'badge-ghost opacity-50',
  }

  const statusBadge: Record<string, string> = {
    'open': 'badge-primary',
    'in-progress': 'badge-warning',
    'done': 'badge-success',
    'closed': 'badge-ghost',
  }
</script>

<a href="#/ticket/{ticket.id}" class="card bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
  <div class="card-body p-3 gap-1">
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs opacity-60">{ticket.id}</span>
      <span class="badge badge-xs {priorityBadge[ticket.priority] || 'badge-ghost'}">P{ticket.priority}</span>
    </div>
    <h3 class="card-title text-sm">{ticket.title}</h3>
    <div class="flex items-center gap-1 flex-wrap">
      <span class="badge badge-sm {statusBadge[ticket.status] || 'badge-ghost'}">{ticket.status}</span>
      {#if ticket.assignee}
        <span class="badge badge-sm badge-outline">{ticket.assignee}</span>
      {/if}
      {#each ticket.tags as tag}
        <span class="badge badge-sm badge-outline opacity-60">{tag}</span>
      {/each}
    </div>
    {#if ticket.deps.length > 0}
      <div class="text-xs opacity-50 mt-1">deps: {ticket.deps.join(', ')}</div>
    {/if}
  </div>
</a>
