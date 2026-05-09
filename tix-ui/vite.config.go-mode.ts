/**
 * Vite config for the Go-server SPA build.
 *
 * Key differences from vite.config.ts:
 *  - No tanstackStart() / Nitro — pure client-side SPA
 *  - No TanStack Start server functions — swapped to plain fetch go-client
 *  - Outputs to dist-go/ (copied into tix-server/ui/ before go build)
 */
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const root = import.meta.dirname
const src = path.resolve(root, 'src')

/**
 * Redirect server-module imports to their go-client fetch equivalents.
 * Matches by resolved absolute path so relative AND #/ imports are caught.
 */
function goModeRedirects(): Plugin {
  const redirects: Array<[RegExp, string]> = [
    [/\/lib\/server\/tickets(\.ts)?$/, path.resolve(src, 'lib/go-client/tickets.ts')],
    [/\/lib\/server\/activity(\.ts)?$/, path.resolve(src, 'lib/go-client/activity.ts')],
    [/\/lib\/client\/ticket-collection(\.ts)?$/, path.resolve(src, 'lib/go-client/ticket-collection.ts')],
    // __root (without .go suffix) → SPA-safe root
    [/\/routes\/__root(?!\.go)(\.tsx)?$/, path.resolve(src, 'routes/__root.go.tsx')],
  ]

  return {
    name: 'go-mode-redirects',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return

      // Compute the likely absolute path without going async.
      let absPath: string
      if (source.startsWith('.')) {
        absPath = path.resolve(path.dirname(importer), source)
      } else if (source.startsWith('#/')) {
        // package.json imports field: #/* → ./src/*
        absPath = path.resolve(src, source.slice(2))
      } else {
        return // third-party module — leave alone
      }
      // Strip extension for matching.
      const noExt = absPath.replace(/\.(tsx?|jsx?)$/, '')
      for (const [pattern, target] of redirects) {
        if (pattern.test(noExt) || pattern.test(absPath)) {
          return target
        }
      }
    },
  }
}

export default defineConfig({
  root,
  build: {
    outDir: path.resolve(root, 'dist-go'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(root, 'index.go.html'),
      // These packages appear only as type-only imports (routeTree.gen.ts) or are
      // redirected away. Mark external so Rollup doesn't try to bundle their
      // Node.js-only internals (AsyncLocalStorage, node:crypto, etc.).
      external: (id) =>
        id.startsWith('@tanstack/react-start') ||
        id.startsWith('@tanstack/start-') ||
        id === 'better-sqlite3' ||
        id.startsWith('@torkbot/sledge'),
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: '#/', replacement: src + '/' }],
  },
  optimizeDeps: {
    exclude: [
      '@tanstack/react-start',
      'better-sqlite3',
      '@torkbot/sledge',
      'chokidar',
    ],
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  plugins: [
    goModeRedirects(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    viteReact(),
  ],
})
