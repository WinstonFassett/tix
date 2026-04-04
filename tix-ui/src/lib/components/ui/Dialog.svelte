<script lang="ts">
  import { cn } from '../../utils'
  import type { Snippet } from 'svelte'

  let {
    open = false,
    onClose,
    class: className = '',
    children,
  }: {
    open?: boolean
    onClose?: () => void
    class?: string
    children?: Snippet
  } = $props()

  $effect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="fixed inset-0 bg-black/80" onclick={onClose}></div>
    <div class={cn(
      'relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg',
      className
    )}>
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
