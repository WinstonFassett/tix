import { createFileRoute, useParams } from '@tanstack/react-router'
import { TicketView } from '#/components/TicketView'

export const Route = createFileRoute('/ticket/$ticketId')({
  component: TicketPage,
})

function TicketPage() {
  const { ticketId } = useParams({ from: '/ticket/$ticketId' })
  return <TicketView ticketId={ticketId} />
}
