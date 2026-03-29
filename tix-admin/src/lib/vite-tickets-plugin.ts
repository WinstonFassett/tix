import type { Plugin, ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'node:fs/promises'
import matter from 'gray-matter'

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
        id: data.id || '',
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

export function ticketsPlugin(): Plugin {
  let ticketsDir: string

  return {
    name: 'tix-tickets',

    configResolved() {
      ticketsDir = resolveTicketsDir()
    },

    configureServer(server: ViteDevServer) {
      // API middleware — must run before Vite's SPA fallback
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/api/tickets') {
          parseTickets(ticketsDir).then(tickets => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(tickets))
          }).catch(() => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to parse tickets' }))
          })
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
