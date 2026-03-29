<script lang="ts">
  import type { Ticket } from '../types'
  import { markdownToHtml } from '../markdown'

  let { ticket, onStatusChange }: { ticket: Ticket, onStatusChange?: (status: string) => void } = $props()

  const statusBadge: Record<string, string> = {
    'open': 'badge-primary',
    'in-progress': 'badge-warning',
    'done': 'badge-success',
    'closed': 'badge-ghost',
  }

  const transitions: Record<string, { label: string, status: string }[]> = {
    'open': [{ label: 'Start', status: 'in-progress' }],
    'in-progress': [{ label: 'Done', status: 'done' }, { label: 'Close', status: 'closed' }],
    'done': [{ label: 'Reopen', status: 'open' }],
    'closed': [{ label: 'Reopen', status: 'open' }],
  }

  function handleStatusChange(newStatus: string) {
    onStatusChange?.(newStatus)
  }
</script>

<div class="max-w-3xl mx-auto">
  <div class="flex items-center gap-2 mb-4">
    <a href="#/" class="btn btn-sm btn-ghost">← Back</a>
  </div>

  <div class="card bg-base-200">
    <div class="card-body">
      <div class="flex items-center gap-2 mb-1">
        <span class="font-mono text-sm opacity-60">{ticket.id}</span>
        <span class="badge {statusBadge[ticket.status] || 'badge-ghost'}">{ticket.status}</span>
        <span class="badge badge-outline">P{ticket.priority}</span>
        <span class="badge badge-outline">{ticket.type}</span>
      </div>

      <h1 class="text-2xl font-bold">{ticket.title}</h1>

      <div class="flex flex-wrap gap-2 mt-2">
        {#if ticket.assignee}
          <div class="text-sm"><span class="opacity-50">Assignee:</span> {ticket.assignee}</div>
        {/if}
        {#if ticket.created}
          <div class="text-sm"><span class="opacity-50">Created:</span> {new Date(ticket.created).toLocaleDateString()}</div>
        {/if}
      </div>

      {#if ticket.tags.length > 0}
        <div class="flex gap-1 mt-2">
          {#each ticket.tags as tag}
            <span class="badge badge-sm badge-outline">{tag}</span>
          {/each}
        </div>
      {/if}

      {#if ticket.deps.length > 0}
        <div class="mt-2 text-sm">
          <span class="opacity-50">Dependencies:</span>
          {#each ticket.deps as dep}
            <a href="#/ticket/{dep}" class="link link-primary font-mono ml-1">{dep}</a>
          {/each}
        </div>
      {/if}

      {#if ticket.links.length > 0}
        <div class="mt-1 text-sm">
          <span class="opacity-50">Links:</span>
          {#each ticket.links as link}
            <a href="#/ticket/{link}" class="link link-primary font-mono ml-1">{link}</a>
          {/each}
        </div>
      {/if}

      {#if onStatusChange && transitions[ticket.status]?.length}
        <div class="flex gap-2 mt-3">
          {#each transitions[ticket.status] as t}
            <button class="btn btn-sm btn-outline" onclick={() => handleStatusChange(t.status)}>
              {t.label}
            </button>
          {/each}
        </div>
      {/if}

      <div class="divider"></div>

      <div class="prose prose-sm max-w-none">
        {@html markdownToHtml(ticket.body)}
      </div>
    </div>
  </div>
</div>
