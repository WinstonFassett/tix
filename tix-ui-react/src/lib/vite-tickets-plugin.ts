import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
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

        if (url === '/api/config' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          const resolvedDir = path.resolve(ticketsDir)
          const workspacePath = path.dirname(resolvedDir)
          res.end(JSON.stringify({ ticketsDir: resolvedDir, workspaceName: path.basename(workspacePath), workspacePath }))
          return
        }

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

        const ticketMatch = url.match(/^\/api\/tickets\/([a-f0-9]+)$/)
        if (ticketMatch && req.method === 'POST') {
          const ticketId = ticketMatch[1]!
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

        if (url === '/api/tickets' && req.method === 'POST') {
          try {
            const body = await readBody(req)
            const { title, description, type, priority, assignee } = JSON.parse(body)
            if (!title) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Title is required' }))
              return
            }
            const args = ['create', title]
            if (description) args.push('-d', description)
            if (type) args.push('--type', type)
            if (priority !== undefined) args.push('--priority', String(priority))
            if (assignee) args.push('--assignee', assignee)

            const workspace = process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd()
            await new Promise<void>((resolve, reject) => {
              execFile('tix', args, { cwd: workspace }, (err, stdout, stderr) => {
                if (err) {
                  reject(new Error(stderr || err.message))
                } else {
                  res.setHeader('Content-Type', 'application/json')
                  const idMatch = stdout.match(/([a-f0-9]{4})/)
                  res.end(JSON.stringify({ ok: true, id: idMatch?.[1] || null, output: stdout.trim() }))
                  resolve()
                }
              })
            })
          } catch (e: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message || 'Failed to create ticket' }))
          }
          return
        }

        next()
      })

      if (fs.existsSync(ticketsDir)) {
        const watcher = fs.watch(ticketsDir, { recursive: true }, () => {
          server.ws.send({ type: 'custom', event: 'tickets-update', data: {} })
        })
        server.httpServer?.on('close', () => watcher.close())
      }
    },
  }
}
