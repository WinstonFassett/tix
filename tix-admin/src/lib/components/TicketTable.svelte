<script lang="ts">
  import type { Ticket } from '../types'
  import { Badge } from './ui'

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

  type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

  const statusVariant: Record<string, BadgeVariant> = {
    'open': 'default',
    'in-progress': 'secondary',
    'done': 'outline',
    'closed': 'outline',
  }
</script>

<div class="overflow-x-auto rounded-md border">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b bg-muted/50">
        <th class="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground" onclick={() => toggleSort('id')}>ID {sortKey === 'id' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground" onclick={() => toggleSort('title')}>Title {sortKey === 'title' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground" onclick={() => toggleSort('status')}>Status {sortKey === 'status' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground" onclick={() => toggleSort('priority')}>Pri {sortKey === 'priority' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground" onclick={() => toggleSort('assignee')}>Assignee {sortKey === 'assignee' ? (sortAsc ? '↑' : '↓') : ''}</th>
        <th class="px-3 py-2 text-left font-medium text-muted-foreground">Tags</th>
      </tr>
    </thead>
    <tbody>
      {#each sorted as ticket (ticket.id)}
        <tr class="border-b transition-colors hover:bg-muted/50 cursor-pointer" onclick={() => location.hash = `#/ticket/${ticket.id}`}>
          <td class="px-3 py-2 font-mono text-xs text-muted-foreground">{ticket.id}</td>
          <td class="px-3 py-2">{ticket.title}</td>
          <td class="px-3 py-2"><Badge variant={statusVariant[ticket.status] ?? 'outline'} class="text-[10px] px-1.5 py-0">{ticket.status}</Badge></td>
          <td class="px-3 py-2">P{ticket.priority}</td>
          <td class="px-3 py-2 text-muted-foreground">{ticket.assignee || '—'}</td>
          <td class="px-3 py-2">
            {#each ticket.tags as tag}
              <Badge variant="outline" class="text-[10px] px-1.5 py-0 mr-1">{tag}</Badge>
            {/each}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
