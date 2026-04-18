import { defineConfig } from 'vite'

const IS_VITEST = !!process.env.VITEST
// import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { webDevMcp } from '@winstonfassett/web-dev-mcp-vite'

// Note: live updates are driven by the WebSocket endpoint at
// server/routes/api/tickets-ws.ts (chokidar-based) which runs in
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
    // devtools() removed — TanStack devtools opens a per-tab SSE connection
    // to /__devtools/sse, consuming 1 of the browser's 6 HTTP/1.1 connection
    // slots. Re-enable only when actively debugging router/query.
    nitro({
      rollupConfig: { external: [/^@sentry\//, 'fsevents'] },
      externals: { inline: [], external: ['@torkbot/sledge', 'better-sqlite3', 'fsevents'] },
      serverDir: './server',
      // WebSocket upgrade handler fails in vitest (no httpServer), so only
      // enable it outside test mode.
      ...(IS_VITEST ? {} : { features: { websocket: true } }),
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    webDevMcp(),
  ],
})

export default config
