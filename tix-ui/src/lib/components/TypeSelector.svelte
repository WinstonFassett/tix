<script lang="ts">
  import Popover from './ui/Popover.svelte'

  let { type, onSelect }: {
    type: string
    onSelect: (type: string) => void
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
      class="h-7 inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 text-sm hover:bg-accent transition-colors"
    >
      <span>{types.find(t => t.id === type)?.label ?? type}</span>
    </button>
  {/snippet}

  {#each types as t}
    <button
      class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors {t.id === type ? 'bg-accent/50' : ''}"
      onclick={() => select(t.id)}
    >
      <span>{t.label}</span>
      {#if t.id === type}
        <svg class="ml-auto h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {/if}
    </button>
  {/each}
</Popover>
