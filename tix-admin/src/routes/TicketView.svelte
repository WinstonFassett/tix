<script lang="ts">
  import { useTickets } from '../lib/data/tickets.svelte'
  import TicketDetail from '../lib/components/TicketDetail.svelte'

  let { ticketId }: { ticketId: string } = $props()

  const store = useTickets()

  const ticket = $derived(store.tickets.find(t => t.id === ticketId))
</script>

{#if store.loading}
  <div class="flex justify-center py-12">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{:else if !ticket}
  <div class="text-center py-12">
    <p class="text-lg opacity-50">Ticket <code class="font-mono">{ticketId}</code> not found</p>
    <a href="#/" class="btn btn-sm btn-ghost mt-4">← Back to dashboard</a>
  </div>
{:else}
  <TicketDetail {ticket} />
{/if}
