<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { Ticket } from '../types'
  import { Button, Input, Select } from './ui'
  import StatusSelector from './StatusSelector.svelte'
  import PrioritySelector from './PrioritySelector.svelte'
  import MilkdownEditor from './MilkdownEditor.svelte'
  import { useSidebar } from '../data/sidebar.svelte'

  const sidebar = useSidebar()

  let { ticket, onUpdate }: {
    ticket: Ticket,
    onUpdate?: (updates: Record<string, any>) => Promise<void> | void
  } = $props()

  // Save state indicator: 'idle' | 'saving' | 'saved' | 'error'
  let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let savedTimer: ReturnType<typeof setTimeout> | null = null

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

  const types = ['task', 'bug', 'feature', 'epic']

  // Debounced save
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function save(updates: Record<string, any>) {
    if (saveTimer) clearTimeout(saveTimer)
    saveState = 'saving'
    if (savedTimer) clearTimeout(savedTimer)
    saveTimer = setTimeout(async () => {
      try {
        await onUpdate?.(updates)
        saveState = 'saved'
        savedTimer = setTimeout(() => { saveState = 'idle' }, 2000)
      } catch {
        saveState = 'error'
      }
    }, 500)
  }

  // Strip leading # Title from body for display (title shown in input instead)
  function stripLeadingTitle(body: string): string {
    return body.replace(/^\s*#\s+[^\n]*\n*/, '')
  }

  const displayBody = stripLeadingTitle(ticket.body || '')

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer)
    if (savedTimer) clearTimeout(savedTimer)
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
  <button
    class="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
    onclick={() => sidebar.toggle()}
    title="Toggle sidebar"
  >
    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
  </button>
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
    {#if saveState === 'saving'}
      <span class="text-xs text-muted-foreground">Saving...</span>
    {:else if saveState === 'saved'}
      <span class="text-xs text-muted-foreground">Saved</span>
    {:else if saveState === 'error'}
      <span class="text-xs text-destructive">Save failed</span>
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
      <StatusSelector status={ticket.status} onSelect={(s) => handleFieldChange('status', s)} />
      <PrioritySelector priority={ticket.priority} onSelect={(p) => handleFieldChange('priority', p)} />

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
    <div class="min-h-50">
      <MilkdownEditor defaultValue={displayBody} onChange={(md) => save({ body: md })} />
    </div>
  </div>
</div>
