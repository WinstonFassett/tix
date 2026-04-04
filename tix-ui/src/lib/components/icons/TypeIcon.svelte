<script lang="ts">
  let { type, size = 14 }: { type: string; size?: number } = $props()

  const colors: Record<string, string> = {
    task: '#94a3b8', bug: '#ef4444', feature: '#3b82f6', epic: '#d946ef',
  }
  const color = $derived(colors[type] || colors['task'])
</script>

{#if type === 'bug'}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Bug">
    <circle cx="8" cy="9" r="4" />
    <path d="M8 5V3" />
    <path d="M6.5 3.5L9.5 3.5" />
    <path d="M4 7L2 6" />
    <path d="M12 7L14 6" />
    <path d="M4 11L2 12" />
    <path d="M12 11L14 12" />
  </svg>
{:else if type === 'feature'}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Feature">
    <polygon points="8,2 10,6.5 15,7 11.5,10.5 12.5,15 8,12.5 3.5,15 4.5,10.5 1,7 6,6.5" />
  </svg>
{:else if type === 'epic'}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Epic">
    <path d="M9 2L4 9H8L7 14L12 7H8L9 2Z" />
  </svg>
{:else}
  <!-- task (default) -->
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Task">
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <path d="M5 8L7 10L11 6" />
  </svg>
{/if}
