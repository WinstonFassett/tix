<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { Ticket } from '../types'
  import { Button, Input, Select } from './ui'
  import StatusIcon from './icons/StatusIcon.svelte'
  import PriorityIcon from './icons/PriorityIcon.svelte'

  let { ticket, onUpdate }: {
    ticket: Ticket,
    onUpdate?: (updates: Record<string, any>) => void
  } = $props()

  // Fetch tickets dir for file path links
  let ticketsDir = $state('')
  onMount(async () => {
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      ticketsDir = data.ticketsDir || ''
    } catch {}
  })

  const filePath = $derived(ticketsDir && ticket.filename ? `${ticketsDir}/${ticket.filename}` : '')

  function copyPath() {
    if (filePath) navigator.clipboard.writeText(filePath)
  }

  const statuses = ['open', 'in-progress', 'on-hold', 'done', 'closed']
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

<!-- Detail header -->
<div class="w-full flex items-center border-b py-1.5 px-6 h-10">
  <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs" onclick={() => location.hash = '#/'}>
    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    Back
  </Button>
  <div class="flex items-center gap-2 ml-3">
    <span class="font-mono text-xs text-muted-foreground">{ticket.id}</span>
    {#if ticket.created}
      <span class="text-xs text-muted-foreground">
        {new Date(ticket.created).toLocaleDateString()}
      </span>
    {/if}
  </div>
  {#if filePath}
    <div class="flex items-center gap-1 ml-auto">
      <span class="text-xs text-muted-foreground font-mono truncate max-w-80" title={filePath}>{ticket.filename}</span>
      <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" onclick={copyPath} title="Copy file path">
        <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </Button>
      <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" onclick={() => window.open(`vscode://file/${filePath}`)} title="Open in VS Code">
        <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </Button>
      <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" onclick={() => window.open(`vscode://file/${ticketsDir}`)} title="Reveal in Finder">
        <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </Button>
    </div>
  {/if}
</div>

<!-- Detail content -->
<div class="flex-1 overflow-auto">
  <div class="max-w-3xl mx-auto py-6 px-6">
    <!-- Title -->
    <input
      type="text"
      class="w-full bg-transparent text-2xl font-bold border-none outline-none placeholder:text-muted-foreground mb-4"
      value={ticket.title}
      onchange={(e) => handleFieldChange('title', (e.target as HTMLInputElement).value)}
      placeholder="Ticket title"
    />

    <!-- Metadata row -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex items-center gap-1.5 border rounded-md px-2 h-8">
        <StatusIcon status={ticket.status} />
        <Select
          class="w-auto h-7 text-sm border-none shadow-none bg-transparent px-0"
          value={ticket.status}
          onchange={(e) => handleFieldChange('status', (e.target as HTMLSelectElement).value)}
        >
          {#each statuses as s}
            <option value={s}>{s}</option>
          {/each}
        </Select>
      </div>

      <div class="flex items-center gap-1.5 border rounded-md px-2 h-8">
        <PriorityIcon priority={ticket.priority} size={14} />
        <Select
          class="w-auto h-7 text-sm border-none shadow-none bg-transparent px-0"
          value={ticket.priority}
          onchange={(e) => handleFieldChange('priority', Number((e.target as HTMLSelectElement).value))}
        >
          {#each priorities as p}
            <option value={p}>P{p}</option>
          {/each}
        </Select>
      </div>

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
    <div class="flex items-center gap-2 mb-4">
      <span class="text-xs text-muted-foreground">Tags:</span>
      <Input
        type="text"
        class="flex-1 h-8 text-sm"
        value={ticket.tags.join(', ')}
        onchange={handleTagsChange}
        placeholder="tag1, tag2, ..."
      />
    </div>

    <!-- Dependencies / Links -->
    {#if ticket.deps.length > 0}
      <div class="text-sm mb-2">
        <span class="text-muted-foreground">Dependencies:</span>
        {#each ticket.deps as dep}
          <a href="#/ticket/{dep}" class="text-primary underline underline-offset-4 font-mono ml-1">{dep}</a>
        {/each}
      </div>
    {/if}

    {#if ticket.links.length > 0}
      <div class="text-sm mb-2">
        <span class="text-muted-foreground">Links:</span>
        {#each ticket.links as link}
          <a href="#/ticket/{link}" class="text-primary underline underline-offset-4 font-mono ml-1">{link}</a>
        {/each}
      </div>
    {/if}

    <hr class="border-border my-4" />

    <!-- Milkdown editor -->
    <div bind:this={editorContainer} class="milkdown-editor prose prose-sm max-w-none min-h-50 dark:prose-invert"></div>
  </div>
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
