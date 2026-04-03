<script lang="ts">
  import { useTickets } from '../lib/data/tickets.svelte'
  import TicketDetail from '../lib/components/TicketDetail.svelte'
  import { Button } from '../lib/components/ui'

  let { ticketId }: { ticketId: string } = $props()

  const store = useTickets()

  const ticket = $derived(store.tickets.find(t => String(t.id) === ticketId))

  async function updateTicket(updates: Record<string, any>) {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Save failed:', data.error)
    }
  }
</script>

{#if store.loading}
  <div class="flex justify-center py-12">
    <svg class="animate-spin h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </div>
{:else if !ticket}
  <div class="w-full flex items-center border-b py-1.5 px-6 h-10">
    <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs" onclick={() => location.hash = '#/'}>
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      Back
    </Button>
  </div>
  <div class="text-center py-12 text-muted-foreground">
    <p>Ticket <code class="font-mono">{ticketId}</code> not found</p>
  </div>
{:else}
  {#key ticket.id}
    <TicketDetail {ticket} onUpdate={updateTicket} />
  {/key}
{/if}
