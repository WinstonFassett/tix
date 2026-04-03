<script lang="ts">
  import { cn } from '../../utils'
  import type { Snippet } from 'svelte'

  type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

  let {
    variant = 'default',
    class: className = '',
    children,
  }: {
    variant?: Variant
    class?: string
    children?: Snippet
  } = $props()

  const variants: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground border border-input',
  }
</script>

<span class={cn(
  'inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors',
  variants[variant],
  className
)}>
  {#if children}{@render children()}{/if}
</span>
