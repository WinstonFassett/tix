<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { Ticket } from '../types'
  import { Button, Card, Input, Select } from './ui'

  let { ticket, onUpdate }: {
    ticket: Ticket,
    onUpdate?: (updates: Record<string, any>) => void
  } = $props()

  const statuses = ['open', 'in-progress', 'done', 'closed']
  const types = ['task', 'bug', 'feature', 'epic']
  const priorities = [0, 1, 2, 3, 4]

  // Debounced save
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function save(updates: Record<string, any>) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      onUpdate?.(updates)
    }, 500)
  }

  // Strip leading # Title from body for display (title shown in input instead)
  function stripLeadingTitle(body: string): string {
    return body.replace(/^\s*#\s+[^\n]*\n*/, '')
  }

  // Milkdown Crepe
  let editorContainer: HTMLDivElement
  let crepe: any = null
  let displayBody = stripLeadingTitle(ticket.body || '')
  let lastBody = displayBody

  onMount(async () => {
    const { Crepe } = await import('@milkdown/crepe')
    await import('@milkdown/crepe/theme/common/style.css')
    await import('@milkdown/crepe/theme/frame.css')

    crepe = new Crepe({
      root: editorContainer,
      defaultValue: displayBody,
    })

    crepe.on((listener: any) => {
      listener.markdownUpdated((_ctx: any, markdown: string) => {
        if (markdown !== lastBody) {
          lastBody = markdown
          save({ body: markdown })
        }
      })
    })

    await crepe.create()
  })

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer)
    crepe?.destroy()
  })

  function handleFieldChange(field: string, value: any) {
    save({ [field]: value })
  }

  function handleTagsChange(e: Event) {
    const input = e.target as HTMLInputElement
    const tags = input.value.split(',').map(t => t.trim()).filter(Boolean)
    save({ tags })
  }
</script>

<div class="max-w-3xl mx-auto">
  <div class="flex items-center gap-2 mb-4">
    <Button variant="ghost" size="sm" onclick={() => location.hash = '#/'}>← Back</Button>
    <span class="font-mono text-sm text-muted-foreground">{ticket.id}</span>
    <span class="text-xs text-muted-foreground">
      {#if ticket.created}
        Created {new Date(ticket.created).toLocaleDateString()}
      {/if}
    </span>
  </div>

  <Card class="p-6">
    <div class="space-y-4">
      <!-- Title -->
      <input
        type="text"
        class="w-full bg-transparent text-2xl font-bold border-none outline-none placeholder:text-muted-foreground"
        value={ticket.title}
        onchange={(e) => handleFieldChange('title', (e.target as HTMLInputElement).value)}
        placeholder="Ticket title"
      />

      <!-- Metadata row -->
      <div class="flex flex-wrap items-center gap-2">
        <Select
          class="w-auto h-8 text-sm"
          value={ticket.status}
          onchange={(e) => handleFieldChange('status', (e.target as HTMLSelectElement).value)}
        >
          {#each statuses as s}
            <option value={s}>{s}</option>
          {/each}
        </Select>

        <Select
          class="w-auto h-8 text-sm"
          value={ticket.priority}
          onchange={(e) => handleFieldChange('priority', Number((e.target as HTMLSelectElement).value))}
        >
          {#each priorities as p}
            <option value={p}>P{p}</option>
          {/each}
        </Select>

        <Select
          class="w-auto h-8 text-sm"
          value={ticket.type}
          onchange={(e) => handleFieldChange('type', (e.target as HTMLSelectElement).value)}
        >
          {#each types as t}
            <option value={t}>{t}</option>
          {/each}
        </Select>

        <Input
          type="text"
          class="w-40 h-8 text-sm"
          value={ticket.assignee}
          onchange={(e) => handleFieldChange('assignee', (e.target as HTMLInputElement).value)}
          placeholder="Assignee"
        />
      </div>

      <!-- Tags -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Tags:</span>
        <Input
          type="text"
          class="flex-1 h-8 text-sm"
          value={ticket.tags.join(', ')}
          onchange={handleTagsChange}
          placeholder="tag1, tag2, ..."
        />
      </div>

      <!-- Dependencies / Links (read-only for now) -->
      {#if ticket.deps.length > 0}
        <div class="text-sm">
          <span class="text-muted-foreground">Dependencies:</span>
          {#each ticket.deps as dep}
            <a href="#/ticket/{dep}" class="text-primary underline underline-offset-4 font-mono ml-1">{dep}</a>
          {/each}
        </div>
      {/if}

      {#if ticket.links.length > 0}
        <div class="text-sm">
          <span class="text-muted-foreground">Links:</span>
          {#each ticket.links as link}
            <a href="#/ticket/{link}" class="text-primary underline underline-offset-4 font-mono ml-1">{link}</a>
          {/each}
        </div>
      {/if}

      <hr class="border-border" />

      <!-- Milkdown editor -->
      <div bind:this={editorContainer} class="milkdown-editor prose prose-sm max-w-none min-h-50 dark:prose-invert"></div>
    </div>
  </Card>
</div>

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
