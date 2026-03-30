import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { handleTicketUpdate } from './ticket-api'

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
}

async function parseTickets(ticketsDir: string) {
  const tickets: any[] = []
  try {
    const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
    for (const filename of entries) {
      const filepath = path.join(ticketsDir, filename)
      const raw = fs.readFileSync(filepath, 'utf-8')
      const { data, content } = matter(raw)
      tickets.push({
        id: String(data.id || ''),
        title: data.title || '',
        status: data.status || 'open',
        deps: data.deps || [],
        links: data.links || [],
        created: data.created || '',
        type: data.type || '',
        priority: data.priority ?? 2,
        assignee: data.assignee || '',
        tags: data.tags || [],
        body: content.trim(),
        filename,
      })
    }
  } catch {
    // tickets dir may not exist yet
  }
  return tickets
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

export function ticketsPlugin(): Plugin {
  let ticketsDir: string

  return {
    name: 'tix-tickets',

    configResolved() {
      ticketsDir = resolveTicketsDir()
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url?.split('?')[0] || ''

        // GET /api/tickets
        if (url === '/api/tickets' && req.method === 'GET') {
          try {
            const tickets = await parseTickets(ticketsDir)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(tickets))
          } catch {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to parse tickets' }))
          }
          return
        }

        // POST /api/tickets/:id — partial update (frontmatter + body)
        const ticketMatch = url.match(/^\/api\/tickets\/([a-f0-9]+)$/)
        if (ticketMatch && req.method === 'POST') {
          const ticketId = ticketMatch[1]
          try {
            const body = await readBody(req)
            const updates = JSON.parse(body)
            const result = await handleTicketUpdate(ticketsDir, ticketId, updates)
            res.setHeader('Content-Type', 'application/json')
            if (result.ok) {
              res.end(JSON.stringify({ ok: true }))
            } else {
              res.statusCode = 400
              res.end(JSON.stringify({ error: result.error }))
            }
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid request body' }))
          }
          return
        }

        next()
      })

      // Watch tickets dir for changes
      if (fs.existsSync(ticketsDir)) {
        const watcher = fs.watch(ticketsDir, { recursive: true }, () => {
          server.ws.send({ type: 'custom', event: 'tickets-update', data: {} })
        })
        server.httpServer?.on('close', () => watcher.close())
      }
    },
  }
}
