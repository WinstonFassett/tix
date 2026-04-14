import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { webDevMcp } from '@winstonfassett/web-dev-mcp-vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Note: live updates are driven by the SSE endpoint at
// server/routes/api/tickets-events.get.ts (chokidar-based) which runs in
// both dev and prod. No vite-plugin watcher needed.

const config = defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['fsevents', 'better-sqlite3', '@torkbot/sledge'],
  },
  ssr: {
    external: ['better-sqlite3', '@torkbot/sledge', 'fsevents'],
  },
  plugins: [
    // HTTP/2 via self-signed cert in dev — prevents SSE connection exhaustion
    // (browsers limit 6 HTTP/1.1 connections per origin; HTTP/2 multiplexes)
    ...(process.env.NODE_ENV !== 'production' ? [basicSsl()] : []),
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//, 'fsevents'] },
      externals: { inline: [], external: ['@torkbot/sledge', 'better-sqlite3', 'fsevents'] },
      // Enable scanning ./server for api/ and routes/ so our SSE endpoint
      // at server/routes/api/tickets-events.get.ts is registered.
      serverDir: './server',
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    webDevMcp(),
  ],
})

export default config
