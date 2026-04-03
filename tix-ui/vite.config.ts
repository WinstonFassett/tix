import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { ticketsPlugin } from './src/lib/vite-tickets-plugin'

// web-dev-mcp: enable with WEB_DEV_MCP=1 env var
const plugins = [svelte(), tailwindcss(), ticketsPlugin()]

if (process.env.WEB_DEV_MCP) {
  try {
    const { webDevMcp } = await import('@winstonfassett/web-dev-mcp-vite')
    plugins.push(webDevMcp())
  } catch {
    console.log('[tix-ui] web-dev-mcp not available')
  }
}

export default defineConfig({
  plugins,
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 5175,
    open: true,
  },
  test: {
    environment: 'jsdom',
    sequence: { concurrent: false },
  },
})
