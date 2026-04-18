import type { Ticket } from '#/lib/types'
import { useConfig } from '#/lib/hooks/use-tickets'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'
import { MoreHorizontal, ExternalLink, ClipboardCopy, Download, Copy, Folder } from 'lucide-react'

function ticketToMarkdown(ticket: Ticket): string {
  const fm = [
    '---',
    `id: "${ticket.id}"`,
    `title: ${JSON.stringify(ticket.title)}`,
    `status: "${ticket.status}"`,
    `deps: [${ticket.deps.map(d => `"${d}"`).join(', ')}]`,
    `created: '${ticket.created}'`,
    `type: ${ticket.type}`,
    `priority: ${ticket.priority}`,
    `assignee: '${ticket.assignee}'`,
    `tags: [${ticket.tags.map(t => JSON.stringify(t)).join(', ')}]`,
    '---',
  ].join('\n')
  return fm + '\n' + ticket.body
}

interface TicketActionsProps {
  ticket: Ticket
  children?: React.ReactNode
}

export function TicketActions({ ticket, children }: TicketActionsProps) {
  const { data: config } = useConfig()
  const ticketsDir = config?.ticketsDir || ''
  const filePath = ticketsDir && ticket.filename ? `${ticketsDir}/${ticket.filename}` : ''

  function copyMarkdown() {
    const md = ticketToMarkdown(ticket)
    navigator.clipboard.writeText(md)
  }

  function downloadMarkdown() {
    const md = ticketToMarkdown(ticket)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = ticket.filename || `${ticket.id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyPath() {
    if (filePath) navigator.clipboard.writeText(filePath)
  }

  function openInVSCode() {
    if (filePath) window.open(`vscode://file/${filePath}`)
  }

  function revealInFinder() {
    if (filePath) window.open(`vscode://file/${ticketsDir}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <button
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
            title="More actions"
            onClick={e => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onSelect={copyMarkdown}>
          <ClipboardCopy className="h-4 w-4" />
          Copy Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadMarkdown}>
          <Download className="h-4 w-4" />
          Download Markdown
        </DropdownMenuItem>
        {filePath && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={copyPath}>
              <Copy className="h-4 w-4" />
              Copy File Path
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openInVSCode}>
              <ExternalLink className="h-4 w-4" />
              Open in VS Code
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={revealInFinder}>
              <Folder className="h-4 w-4" />
              Reveal in Finder
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
