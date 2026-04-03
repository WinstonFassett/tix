<script lang="ts">
  import { parseHash, navigate, type Route } from './lib/data/router'
  import DashboardView from './routes/DashboardView.svelte'
  import TicketView from './routes/TicketView.svelte'
  import Button from './lib/components/ui/Button.svelte'

  let route = $state<Route>(parseHash(location.hash))
  let dark = $state(false)

  $effect(() => {
    const onHash = () => { route = parseHash(location.hash) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  })

  function toggleTheme() {
    dark = !dark
    document.documentElement.classList.toggle('dark', dark)
  }
</script>

<div class="min-h-screen bg-background text-foreground">
  <header class="flex items-center border-b px-4 h-14">
    <a href="#/" class="text-xl font-mono font-semibold tracking-tight mr-auto">tix</a>
    <Button variant="ghost" size="icon" onclick={toggleTheme}>
      {#if dark}
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      {:else}
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      {/if}
    </Button>
  </header>

  <main class="p-4">
    {#if route.view === 'ticket' && route.ticketId}
      <TicketView ticketId={route.ticketId} />
    {:else}
      <DashboardView />
    {/if}
  </main>
</div>
