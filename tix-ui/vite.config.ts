import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { ticketsPlugin } from './src/lib/vite-tickets-plugin'

export default defineConfig(async ({ command }) => {
  const plugins = [svelte(), tailwindcss(), ticketsPlugin()]

  if (command === 'serve' || process.env.NODE_ENV !== 'production') {
    try {
      const { webDevMcp } = await import('@winstonfassett/web-dev-mcp-vite')
      plugins.push(webDevMcp() as Plugin)
    } catch {}
  }

  return {
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
  }
})
