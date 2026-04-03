<script lang="ts">
  let { status, size = 14 }: { status: string; size?: number } = $props()

  const config: Record<string, { color: string; progress: number; dashed?: boolean; check?: boolean }> = {
    'open':        { color: '#f97316', progress: 0, dashed: false },
    'in-progress': { color: '#facc15', progress: 0.33 },
    'done':        { color: '#8b5cf6', progress: 1, check: true },
    'closed':      { color: '#94a3b8', progress: 0, dashed: true },
  }

  const c = $derived(config[status] ?? config['open'])
  const r = 2
  const circumference = 2 * Math.PI * r
  const dashArray = $derived(`${circumference * c.progress} 100`)
</script>

<svg width={size} height={size} viewBox="0 0 14 14" fill="none">
  <circle
    cx="7" cy="7" r="6"
    fill="none"
    stroke={c.color}
    stroke-width="2"
    stroke-dasharray={c.dashed ? '1.4 1.74' : '3.14 0'}
    stroke-dashoffset={c.dashed ? '0.65' : '-0.7'}
  />
  {#if c.check}
    <path
      d="M4.5 7L6.5 9L9.5 5"
      stroke={c.color}
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {:else}
    <circle
      cx="7" cy="7" r={r}
      fill="none"
      stroke={c.color}
      stroke-width="4"
      stroke-dasharray={dashArray}
      stroke-dashoffset="0"
      transform="rotate(-90 7 7)"
    />
  {/if}
</svg>
