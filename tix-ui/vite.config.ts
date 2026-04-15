import { defineConfig } from 'vite'
// import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { webDevMcp } from '@winstonfassett/web-dev-mcp-vite'

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
    // devtools() removed — TanStack devtools opens a per-tab SSE connection
    // to /__devtools/sse, consuming 1 of the browser's 6 HTTP/1.1 connection
    // slots. Combined with our own SSE, 3 tabs = 6 SSE = total connection
    // exhaustion. Re-enable only when actively debugging router/query.
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
