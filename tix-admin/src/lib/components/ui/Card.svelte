<script lang="ts">
  import { cn } from '../../utils'
  import type { Snippet } from 'svelte'

  let {
    class: className = '',
    children,
  }: {
    class?: string
    children?: Snippet
  } = $props()
</script>

<div class={cn('rounded-xl border bg-card text-card-foreground shadow', className)}>
  {#if children}{@render children()}{/if}
</div>
