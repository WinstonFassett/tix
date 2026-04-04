<script lang="ts">
  import Popover from './ui/Popover.svelte'
  import TypeIcon from './icons/TypeIcon.svelte'

  let { type, onSelect, compact = false }: {
    type: string
    onSelect: (type: string) => void
    compact?: boolean
  } = $props()

  let open = $state(false)

  const types = [
    { id: 'task', label: 'Task' },
    { id: 'bug', label: 'Bug' },
    { id: 'feature', label: 'Feature' },
    { id: 'epic', label: 'Epic' },
  ]

  function select(id: string) {
    open = false
    if (id !== type) onSelect(id)
  }
</script>

<Popover bind:open>
  {#snippet trigger()}
    <button
      class="h-7 inline-flex items-center gap-1.5 rounded-md {compact ? 'px-1.5 hover:bg-accent' : 'bg-secondary px-2 hover:bg-accent'} text-sm transition-colors"
      title={types.find(t => t.id === type)?.label ?? type}
    >
      <TypeIcon {type} size={compact ? 14 : 12} />
      {#if !compact}
        <span>{types.find(t => t.id === type)?.label ?? type}</span>
      {/if}
    </button>
  {/snippet}

  {#each types as t}
    <button
      class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors {t.id === type ? 'bg-accent/50' : ''}"
      onclick={() => select(t.id)}
    >
      <TypeIcon type={t.id} size={14} />
      <span>{t.label}</span>
      {#if t.id === type}
        <svg class="ml-auto h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {/if}
    </button>
  {/each}
</Popover>
