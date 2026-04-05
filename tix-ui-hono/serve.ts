import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import fs from 'node:fs'
import path from 'node:path'
import { parseTickets, handleTicketUpdate } from './lib/ticket-api'

// --- Config ---

const ticketsDir = process.env.TICKETS_DIR
  || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')

const distDir = path.join(import.meta.dir, 'dist')
const port = parseInt(process.env.PORT || '5175', 10)

// --- WebSocket clients ---

const wsClients = new Set<ServerWebSocket<unknown>>()

type ServerWebSocket<T> = {
  send(data: string | ArrayBuffer | Uint8Array): void
  close(): void
  data: T
}

// --- Hono app ---

const app = new Hono()

// GET /api/config
app.get('/api/config', (c) => {
  const resolvedDir = path.resolve(ticketsDir)
  const workspacePath = path.dirname(resolvedDir)
  return c.json({
    ticketsDir: resolvedDir,
    workspaceName: path.basename(workspacePath),
    workspacePath,
  })
})

// GET /api/tickets
app.get('/api/tickets', (c) => {
  try {
    const tickets = parseTickets(ticketsDir)
    return c.json(tickets)
  } catch {
    return c.json({ error: 'Failed to parse tickets' }, 500)
  }
})

// POST /api/tickets/:ticketId — update
app.post('/api/tickets/:ticketId', async (c) => {
  const ticketId = c.req.param('ticketId')
  try {
    const updates = await c.req.json()
    const result = handleTicketUpdate(ticketsDir, ticketId, updates)
    if (result.ok) {
      return c.json({ ok: true })
    }
    return c.json({ error: result.error }, 400)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }
})

// POST /api/tickets — create
app.post('/api/tickets', async (c) => {
  try {
    const { title, description, type, priority, assignee } = await c.req.json()
    if (!title) {
      return c.json({ error: 'Title is required' }, 400)
    }

    const args = ['create', title]
    if (description) args.push('-d', description)
    if (type) args.push('--type', type)
    if (priority !== undefined) args.push('--priority', String(priority))
    if (assignee) args.push('--assignee', assignee)

    const workspace = process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd()
    const proc = Bun.spawn(['tix', ...args], { cwd: workspace, stdout: 'pipe', stderr: 'pipe' })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      return c.json({ error: stderr || 'Failed to create ticket' }, 500)
    }

    const idMatch = stdout.match(/([a-f0-9]{4})/)
    return c.json({ ok: true, id: idMatch?.[1] || null, output: stdout.trim() })
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to create ticket' }, 500)
  }
})

// --- Static file serving with WS client injection ---

const wsScript = `<script>
(function() {
  function connect() {
    var ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onmessage = function(e) {
      if (e.data === 'tickets-update') {
        window.dispatchEvent(new CustomEvent('tickets-update'));
      }
    };
    ws.onclose = function() { setTimeout(connect, 1000); };
  }
  connect();
})();
</script>`

function serveIndex(c: any) {
  const indexPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(indexPath)) {
    return c.text('No dist/ found. Run: bun run build', 404)
  }
  const html = fs.readFileSync(indexPath, 'utf-8').replace('</head>', wsScript + '\n</head>')
  return c.html(html)
}

app.get('/', (c) => serveIndex(c))

// Serve static assets from dist/
app.use('/*', serveStatic({ root: './dist' }))

// SPA fallback for client-side routes
app.get('*', (c) => serveIndex(c))

// --- File watcher ---

if (fs.existsSync(ticketsDir)) {
  fs.watch(ticketsDir, { recursive: true }, () => {
    for (const ws of wsClients) {
      try {
        ws.send('tickets-update')
      } catch {
        wsClients.delete(ws)
      }
    }
  })
}

// --- Start server with WebSocket upgrade ---

const server = Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url)
    // Upgrade WebSocket connections
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    // Everything else goes to Hono
    return app.fetch(req)
  },
  websocket: {
    open(ws) {
      wsClients.add(ws)
    },
    close(ws) {
      wsClients.delete(ws)
    },
    message() {
      // client→server messages not needed
    },
  },
})

console.log(`tix-ui: http://localhost:${server.port}`)
console.log(`  tickets: ${path.resolve(ticketsDir)}`)
