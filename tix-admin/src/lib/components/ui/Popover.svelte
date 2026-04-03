<script lang="ts">
  import { cn } from '../../utils'
  import type { Snippet } from 'svelte'

  let {
    open = $bindable(false),
    align = 'start' as 'start' | 'end',
    class: className = '',
    trigger,
    children,
  }: {
    open?: boolean
    align?: 'start' | 'end'
    class?: string
    trigger: Snippet
    children?: Snippet
  } = $props()

  let triggerEl = $state<HTMLElement>(null!)
  let popoverEl = $state<HTMLElement>(null!)
  let top = $state(0)
  let left = $state(0)

  function handleTriggerClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!open) {
      const rect = triggerEl.getBoundingClientRect()
      top = rect.bottom + 4
      left = align === 'end' ? rect.right : rect.left
    }
    open = !open
  }

  function handlePopoverClick(e: MouseEvent) {
    e.stopPropagation()
  }

  $effect(() => {
    if (open) {
      const handler = (e: MouseEvent) => {
        const target = e.target as Node
        if (popoverEl && !popoverEl.contains(target) && triggerEl && !triggerEl.contains(target)) {
          open = false
        }
      }
      // Defer so the opening click doesn't immediately close
      const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handler)
      }
    }
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="inline-flex" bind:this={triggerEl} onclick={handleTriggerClick}>
  {@render trigger()}
</span>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={popoverEl}
    class={cn(
      'fixed z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
      className
    )}
    style="top: {top}px; {align === 'end' ? `right: ${window.innerWidth - left}px` : `left: ${left}px`};"
    onclick={handlePopoverClick}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
