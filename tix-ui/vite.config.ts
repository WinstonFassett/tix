import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
}

function ticketsWatcherPlugin(): Plugin {
  return {
    name: 'tix-tickets-watcher',
    configureServer(server: ViteDevServer) {
      const ticketsDir = resolveTicketsDir()
      if (fs.existsSync(ticketsDir)) {
        const watcher = fs.watch(ticketsDir, { recursive: true }, () => {
          server.ws.send({ type: 'custom', event: 'tickets-update', data: {} })
        })
        server.httpServer?.on('close', () => watcher.close())
      }
    },
  }
}

const config = defineConfig({
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    ticketsWatcherPlugin(),
  ],
})

export default config
