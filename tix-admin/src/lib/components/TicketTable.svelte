<script lang="ts">
  import type { Ticket } from '../types'

  let { tickets }: { tickets: Ticket[] } = $props()

  let sortKey = $state<keyof Ticket>('priority')
  let sortAsc = $state(true)

  const sorted = $derived.by(() => {
    return [...tickets].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
  })

  function toggleSort(key: keyof Ticket) {
    if (sortKey === key) {
      sortAsc = !sortAsc
    } else {
      sortKey = key
      sortAsc = true
    }
  }

  const statusBadge: Record<string, string> = {
    'open': 'badge-primary',
    'in-progress': 'badge-warning',
    'done': 'badge-success',
    'closed': 'badge-ghost',
  }
</script>

<div class="overflow-x-auto">
  <table class="table table-sm">
    <thead>
      <tr>
        <th class="cursor-pointer" onclick={() => toggleSort('id')}>ID {sortKey === 'id' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer" onclick={() => toggleSort('title')}>Title {sortKey === 'title' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer" onclick={() => toggleSort('status')}>Status {sortKey === 'status' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer" onclick={() => toggleSort('priority')}>Pri {sortKey === 'priority' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer" onclick={() => toggleSort('assignee')}>Assignee {sortKey === 'assignee' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th>Tags</th>
      </tr>
    </thead>
    <tbody>
      {#each sorted as ticket (ticket.id)}
        <tr class="hover cursor-pointer" onclick={() => location.hash = `#/ticket/${ticket.id}`}>
          <td class="font-mono text-xs">{ticket.id}</td>
          <td>{ticket.title}</td>
          <td><span class="badge badge-sm {statusBadge[ticket.status] || 'badge-ghost'}">{ticket.status}</span></td>
          <td>P{ticket.priority}</td>
          <td class="text-sm">{ticket.assignee || '—'}</td>
          <td>
            {#each ticket.tags as tag}
              <span class="badge badge-xs badge-outline">{tag}</span>
            {/each}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
