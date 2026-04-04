import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ticketsPlugin } from './src/lib/vite-tickets-plugin'
import path from 'node:path'

export default defineConfig(async ({ command }) => {
  const plugins = [react(), tailwindcss(), ticketsPlugin()]

  if (command === 'serve' || process.env.NODE_ENV !== 'production') {
    try {
      // @ts-expect-error - optional peer dependency
      const { webDevMcp } = await import('@winstonfassett/web-dev-mcp-vite')
      plugins.push(webDevMcp() as Plugin)
    } catch {}
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      preserveSymlinks: true,
    },
    server: {
      port: 5175,
      open: true,
    },
  }
})
