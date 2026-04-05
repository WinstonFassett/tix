#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ticketsDir = process.env.TICKETS_DIR
  || resolve(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')

if (!existsSync(ticketsDir)) {
  console.error(`No tickets/ directory found at ${ticketsDir}`)
  console.error('Run from a directory with tickets/ or set TIX_WORKSPACE')
  process.exit(1)
}

// Import the server (starts on import)
await import('../serve.ts')
