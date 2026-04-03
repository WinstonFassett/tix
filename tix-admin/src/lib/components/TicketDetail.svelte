<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { Ticket } from '../types'

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
  function flushSave() {
    // nothing pending in the field inputs — they save on change
  }

  // Milkdown Crepe
  let editorContainer: HTMLDivElement
  let crepe: any = null
  let lastBody = ticket.body

  onMount(async () => {
    const { Crepe } = await import('@milkdown/crepe')
    await import('@milkdown/crepe/theme/common/style.css')
    await import('@milkdown/crepe/theme/frame.css')

    crepe = new Crepe({
      root: editorContainer,
      defaultValue: ticket.body || '',
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
    <a href="#/" class="btn btn-sm btn-ghost">← Back</a>
    <span class="font-mono text-sm opacity-40">{ticket.id}</span>
    <span class="text-xs opacity-30">
      {#if ticket.created}
        Created {new Date(ticket.created).toLocaleDateString()}
      {/if}
    </span>
  </div>

  <div class="card bg-base-200">
    <div class="card-body gap-3">
      <!-- Title -->
      <input
        type="text"
        class="input input-lg input-ghost text-2xl font-bold w-full p-0"
        value={ticket.title}
        onchange={(e) => handleFieldChange('title', (e.target as HTMLInputElement).value)}
        placeholder="Ticket title"
      />

      <!-- Metadata row -->
      <div class="flex flex-wrap items-center gap-2">
        <select
          class="select select-sm select-bordered"
          value={ticket.status}
          onchange={(e) => handleFieldChange('status', (e.target as HTMLSelectElement).value)}
        >
          {#each statuses as s}
            <option value={s}>{s}</option>
          {/each}
        </select>

        <select
          class="select select-sm select-bordered"
          value={ticket.priority}
          onchange={(e) => handleFieldChange('priority', Number((e.target as HTMLSelectElement).value))}
        >
          {#each priorities as p}
            <option value={p}>P{p}</option>
          {/each}
        </select>

        <select
          class="select select-sm select-bordered"
          value={ticket.type}
          onchange={(e) => handleFieldChange('type', (e.target as HTMLSelectElement).value)}
        >
          {#each types as t}
            <option value={t}>{t}</option>
          {/each}
        </select>

        <input
          type="text"
          class="input input-sm input-bordered w-40"
          value={ticket.assignee}
          onchange={(e) => handleFieldChange('assignee', (e.target as HTMLInputElement).value)}
          placeholder="Assignee"
        />
      </div>

      <!-- Tags -->
      <div class="flex items-center gap-2">
        <span class="text-xs opacity-50">Tags:</span>
        <input
          type="text"
          class="input input-sm input-bordered flex-1"
          value={ticket.tags.join(', ')}
          onchange={handleTagsChange}
          placeholder="tag1, tag2, ..."
        />
      </div>

      <!-- Dependencies / Links (read-only for now) -->
      {#if ticket.deps.length > 0}
        <div class="text-sm">
          <span class="opacity-50">Dependencies:</span>
          {#each ticket.deps as dep}
            <a href="#/ticket/{dep}" class="link link-primary font-mono ml-1">{dep}</a>
          {/each}
        </div>
      {/if}

      {#if ticket.links.length > 0}
        <div class="text-sm">
          <span class="opacity-50">Links:</span>
          {#each ticket.links as link}
            <a href="#/ticket/{link}" class="link link-primary font-mono ml-1">{link}</a>
          {/each}
        </div>
      {/if}

      <div class="divider my-1"></div>

      <!-- Milkdown editor -->
      <div bind:this={editorContainer} class="milkdown-editor prose prose-sm max-w-none min-h-50"></div>
    </div>
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
