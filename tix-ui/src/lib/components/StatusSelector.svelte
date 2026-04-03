<script lang="ts">
  import StatusIcon from './icons/StatusIcon.svelte'
  import Popover from './ui/Popover.svelte'

  let { status, onSelect, compact = false }: {
    status: string
    onSelect: (status: string) => void
    compact?: boolean
  } = $props()

  let open = $state(false)

  const statuses = [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'on-hold', label: 'On Hold' },
    { id: 'done', label: 'Done' },
    { id: 'closed', label: 'Closed' },
  ]

  function select(id: string) {
    open = false
    if (id !== status) onSelect(id)
  }
</script>

<Popover bind:open>
  {#snippet trigger()}
    <button
      class="h-7 inline-flex items-center gap-1.5 rounded-md {compact ? 'px-1.5 hover:bg-accent' : 'bg-secondary px-2 hover:bg-accent'} text-sm transition-colors"
      title={statuses.find(s => s.id === status)?.label ?? status}
    >
      <StatusIcon {status} size={compact ? 14 : 12} />
      {#if !compact}
        <span>{statuses.find(s => s.id === status)?.label ?? status}</span>
      {/if}
    </button>
  {/snippet}

  {#each statuses as s}
    <button
      class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors {s.id === status ? 'bg-accent/50' : ''}"
      onclick={() => select(s.id)}
    >
      <StatusIcon status={s.id} size={12} />
      <span>{s.label}</span>
      {#if s.id === status}
        <svg class="ml-auto h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {/if}
    </button>
  {/each}
</Popover>
