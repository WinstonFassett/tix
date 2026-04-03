<script lang="ts">
  import PriorityIcon from './icons/PriorityIcon.svelte'
  import Popover from './ui/Popover.svelte'

  let { priority, onSelect, compact = false }: {
    priority: number
    onSelect: (priority: number) => void
    compact?: boolean
  } = $props()

  let open = $state(false)

  const priorities = [
    { value: 0, label: 'Urgent' },
    { value: 1, label: 'High' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'Low' },
    { value: 4, label: 'No priority' },
  ]

  function select(value: number) {
    open = false
    if (value !== priority) onSelect(value)
  }
</script>

<Popover bind:open>
  {#snippet trigger()}
    <button
      class="h-7 inline-flex items-center gap-1.5 rounded-md {compact ? 'px-1.5 hover:bg-accent' : 'bg-secondary px-2 hover:bg-accent'} text-sm transition-colors"
      title={priorities.find(p => p.value === priority)?.label ?? `P${priority}`}
    >
      <PriorityIcon {priority} size={compact ? 14 : 12} />
      {#if !compact}
        <span>{priorities.find(p => p.value === priority)?.label ?? `P${priority}`}</span>
      {/if}
    </button>
  {/snippet}

  {#each priorities as p}
    <button
      class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors {p.value === priority ? 'bg-accent/50' : ''}"
      onclick={() => select(p.value)}
    >
      <PriorityIcon priority={p.value} size={14} />
      <span>{p.label}</span>
      {#if p.value === priority}
        <svg class="ml-auto h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {/if}
    </button>
  {/each}
</Popover>
