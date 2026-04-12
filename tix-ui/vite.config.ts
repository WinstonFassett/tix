import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
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
  optimizeDeps: {
    exclude: ['fsevents', '@livestore/adapter-node', 'better-sqlite3'],
  },
  ssr: {
    external: ['@livestore/adapter-node', 'better-sqlite3', 'fsevents'],
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//, /^@livestore\//, 'fsevents'] },
      externals: { inline: [], external: ['@livestore/livestore', '@livestore/adapter-node', '@livestore/common', 'fsevents'] },
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
