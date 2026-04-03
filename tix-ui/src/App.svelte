<script lang="ts">
  import { parseHash, type Route } from './lib/data/router'
  import DashboardView from './routes/DashboardView.svelte'
  import TicketView from './routes/TicketView.svelte'
  import Button from './lib/components/ui/Button.svelte'
  import { useTickets } from './lib/data/tickets.svelte'
  import { useFilters } from './lib/data/filters.svelte'
  import StatusIcon from './lib/components/icons/StatusIcon.svelte'
  import { useSidebar } from './lib/data/sidebar.svelte'
  import { useViewSettings } from './lib/data/view-settings.svelte'
  import CommandPalette from './lib/components/CommandPalette.svelte'
  import type { PaletteCallbacks } from './lib/data/palette-items'

  let route = $state<Route>(parseHash(location.hash))
  let dark = $state(localStorage.getItem('tix-theme') === 'dark')
  const sidebar = useSidebar()
  const viewSettings = useViewSettings()

  // Apply persisted theme on load
  if (dark) document.documentElement.classList.add('dark')

  const store = useTickets()
  const filters = useFilters()

  let showCreate = $state(false)

  // Current ticket (derived from route)
  const currentTicket = $derived(
    route.view === 'ticket' && route.ticketId
      ? store.tickets.find(t => String(t.id) === route.ticketId)
      : undefined
  )

  // Tickets dir for file operations
  let ticketsDir = $state('')
  fetch('/api/config').then(r => r.json()).then(d => ticketsDir = d.ticketsDir || '').catch(() => {})

  const currentFilePath = $derived(
    ticketsDir && currentTicket?.filename ? `${ticketsDir}/${currentTicket.filename}` : ''
  )

  async function updateCurrentTicket(updates: Record<string, any>) {
    if (!currentTicket) return
    const res = await fetch(`/api/tickets/${currentTicket.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Save failed:', data.error)
    }
  }

  const paletteCallbacks: PaletteCallbacks = $derived({
    toggleTheme,
    toggleSidebar: () => sidebar.toggle(),
    openCreate: () => { showCreate = true },
    setViewMode: (m) => { viewSettings.viewMode = m },
    setGroupBy: (g) => { viewSettings.groupBy = g },
    setSortBy: (s) => { viewSettings.sortBy = s },
    toggleSortDir: () => viewSettings.toggleSortDir(),
    ...(currentTicket ? {
      updateTicket: (updates: Record<string, any>) => updateCurrentTicket(updates),
      copyFilePath: currentFilePath ? () => navigator.clipboard.writeText(currentFilePath) : undefined,
      openInVSCode: currentFilePath ? () => window.open(`vscode://file/${currentFilePath}`) : undefined,
      revealInFinder: ticketsDir ? () => window.open(`vscode://file/${ticketsDir}`) : undefined,
    } : {}),
  })

  // Derive tag counts from tickets
  const tagCounts = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const t of store.tickets) {
      for (const tag of t.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  })

  const statusCounts = $derived.by(() => {
    const counts: Record<string, number> = { open: 0, 'in-progress': 0, 'on-hold': 0, done: 0, closed: 0 }
    for (const t of store.tickets) {
      if (t.status in counts) counts[t.status]++
    }
    return counts
  })

  const statusLabels: Record<string, string> = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'on-hold': 'On Hold',
    'done': 'Done',
    'closed': 'Closed',
  }

  $effect(() => {
    const onHash = () => { route = parseHash(location.hash) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  })

  function toggleTheme() {
    dark = !dark
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('tix-theme', dark ? 'dark' : 'light')
  }


  function toggleStatusFilter(status: string) {
    filters.tagFilter = ''
    filters.statusFilter = filters.statusFilter === status ? '' : status
    if (route.view !== 'dashboard') location.hash = '#/'
  }

  function toggleTagFilter(tag: string) {
    filters.statusFilter = ''
    filters.tagFilter = filters.tagFilter === tag ? '' : tag
    if (route.view !== 'dashboard') location.hash = '#/'
  }
</script>

<div class="flex h-svh bg-background text-foreground overflow-hidden">
  <!-- Sidebar -->
  <aside class="{sidebar.open ? 'w-60' : 'w-0'} shrink-0 flex flex-col bg-background transition-[width] duration-200 overflow-hidden lg:py-2">
    <!-- Sidebar header -->
    <div class="h-10 flex items-center px-4 min-w-60">
      <a href="#/" class="text-sm font-semibold font-mono tracking-tight" onclick={() => filters.clearAll()}>tix</a>
    </div>

    <!-- Nav sections -->
    <nav class="flex-1 overflow-y-auto py-2">
      <!-- All Issues -->
      <div class="px-2 mb-1">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors {!filters.statusFilter && !filters.tagFilter ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}"
          onclick={() => { filters.clearAll(); location.hash = '#/' }}
        >
          <svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45,5.11,2,12v6a2,2,0,0,0,2,2H20a2,2,0,0,0,2-2V12l-3.45-6.89A2,2,0,0,0,16.76,4H7.24a2,2,0,0,0-1.79,1.11Z"/></svg>
          <span>All Issues</span>
          <span class="ml-auto text-xs text-muted-foreground">{store.tickets.length}</span>
        </div>
      </div>

      <!-- Status counts -->
      <div class="px-3 mt-4 mb-1">
        <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
      </div>
      <div class="px-2">
        {#each Object.entries(statusCounts) as [status, count]}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors {filters.statusFilter === status ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
            onclick={() => toggleStatusFilter(status)}
          >
            <StatusIcon {status} size={12} />
            <span>{statusLabels[status]}</span>
            <span class="ml-auto text-xs">{count}</span>
          </div>
        {/each}
      </div>

      <!-- Tags -->
      {#if tagCounts.length > 0}
        <div class="px-3 mt-4 mb-1">
          <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
        </div>
        <div class="px-2">
          {#each tagCounts.slice(0, 12) as [tag, count]}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors {filters.tagFilter === tag ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
              onclick={() => toggleTagFilter(tag)}
            >
              <svg class="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4"/></svg>
              <span class="truncate">{tag}</span>
              <span class="ml-auto text-xs">{count}</span>
            </div>
          {/each}
        </div>
      {/if}
    </nav>

    <!-- Sidebar footer -->
    <div class="border-t p-2 flex items-center justify-between">
      <Button variant="ghost" size="icon" class="h-8 w-8" onclick={toggleTheme}>
        {#if dark}
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        {:else}
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        {/if}
      </Button>
    </div>
  </aside>

  <!-- Main content area -->
  <div class="flex-1 h-svh overflow-hidden lg:p-2">
    <div class="lg:border lg:rounded-md overflow-hidden flex flex-col h-full bg-background">
      {#if route.view === 'ticket' && route.ticketId}
        <TicketView ticketId={route.ticketId} />
      {:else}
        <DashboardView bind:showCreate />
      {/if}
    </div>
  </div>
</div>

<CommandPalette
  tickets={store.tickets}
  {route}
  callbacks={paletteCallbacks}
/>
