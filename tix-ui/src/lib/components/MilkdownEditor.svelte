<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  let { defaultValue = '', onChange }: {
    defaultValue?: string
    onChange?: (markdown: string) => void
  } = $props()

  let container: HTMLDivElement
  let crepe: any = null
  let lastValue = defaultValue

  onMount(async () => {
    const { Crepe } = await import('@milkdown/crepe')
    await import('@milkdown/crepe/theme/common/style.css')
    await import('@milkdown/crepe/theme/frame.css')

    crepe = new Crepe({
      root: container,
      defaultValue,
    })

    crepe.on((listener: any) => {
      listener.markdownUpdated((_ctx: any, markdown: string) => {
        if (markdown !== lastValue) {
          lastValue = markdown
          onChange?.(markdown)
        }
      })
    })

    await crepe.create()
  })

  onDestroy(() => {
    crepe?.destroy()
  })

  export function getMarkdown(): string {
    return lastValue
  }
</script>

<div bind:this={container} class="milkdown-editor prose prose-sm max-w-none dark:prose-invert"></div>

<style>
  .milkdown-editor :global(.milkdown) {
    outline: none;
    background: transparent;
    padding: 8px 0;
  }
  .milkdown-editor :global(.milkdown .editor) {
    padding: 0;
  }
</style>
