#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ensure dev mode so vite plugins (e.g. web-dev-mcp) activate
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'

// Resolve tickets directory
const ticketsDir = process.env.TICKETS_DIR
  || resolve(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')

if (!existsSync(ticketsDir)) {
  console.error(`No tickets/ directory found at ${ticketsDir}`)
  console.error('Run from a directory with tickets/ or set TIX_WORKSPACE')
  process.exit(1)
}

console.log(`tix-ui: serving ${ticketsDir}`)

const server = await createServer({
  root: resolve(__dirname, '..'),
  server: {
    open: true,
  },
})

await server.listen()
server.printUrls()
