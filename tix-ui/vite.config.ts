import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Note: live updates are driven by the SSE endpoint at
// server/routes/api/tickets-events.get.ts (chokidar-based) which runs in
// both dev and prod. No vite-plugin watcher needed.

const config = defineConfig({
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // Enable scanning ./server for api/ and routes/ so our SSE endpoint
      // at server/routes/api/tickets-events.get.ts is registered.
      serverDir: './server',
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
