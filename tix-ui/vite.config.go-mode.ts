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

const SERVER_ONLY_PKGS = [
  '@tanstack/react-start',
  '@tanstack/start-',
  'better-sqlite3',
  '@torkbot/sledge',
  'chokidar',
]

/** Replace server-only bare package imports with empty virtual modules. */
function emptyServerModules(): Plugin {
  const PREFIX = '\0empty:'
  return {
    name: 'empty-server-modules',
    enforce: 'pre',
    resolveId(id) {
      // Bare package stubs (e.g. @tanstack/react-start, better-sqlite3)
      if (SERVER_ONLY_PKGS.some(p => id === p || id.startsWith(p + '/'))) {
        return PREFIX + id
      }
    },
    load(id) {
      if (id.startsWith(PREFIX)) {
        return { code: 'export default {}', syntheticNamedExports: true }
      }
    },
  }
}

/**
 * Redirect server-module imports to their go-client fetch equivalents.
 * Matches by resolved absolute path so relative AND #/ imports are caught.
 */
function goModeRedirects(): Plugin {
  const serverSrcDir = path.resolve(src, 'lib/server')
  const EMPTY = '\0empty-server-local:'

  const redirects: Array<[RegExp, string]> = [
    [/\/lib\/server\/tickets(\.ts)?$/, path.resolve(src, 'lib/go-client/tickets.ts')],
    [/\/lib\/server\/activity(\.ts)?$/, path.resolve(src, 'lib/go-client/activity.ts')],
    [/\/lib\/client\/ticket-collection(\.ts)?$/, path.resolve(src, 'lib/go-client/ticket-collection.ts')],
    // __root → SPA-safe root (file lives outside routes/ to avoid router discovery)
    [/\/routes\/__root(\.tsx)?$/, path.resolve(src, '__root.go.tsx')],
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
        absPath = path.resolve(src, source.slice(2))
      } else if (path.isAbsolute(source)) {
        // Vite's alias plugin may have already resolved #/ to an absolute path.
        absPath = source
      } else {
        return // third-party bare specifier — leave alone
      }
      // Strip extension for matching.
      const noExt = absPath.replace(/\.(tsx?|jsx?)$/, '')
      for (const [pattern, target] of redirects) {
        if (pattern.test(noExt) || pattern.test(absPath)) {
          return target
        }
      }
      // Catch-all: any remaining lib/server/** (Sledge, sync, etc.)
      // that was NOT redirected above must not reach the browser bundle.
      if (absPath.startsWith(serverSrcDir + '/') || absPath === serverSrcDir) {
        return EMPTY + absPath
      }
    },
    load(id) {
      if (id.startsWith(EMPTY)) {
        return { code: 'export default {}', syntheticNamedExports: true }
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
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: '#/', replacement: src + '/' }],
  },
  optimizeDeps: {
    exclude: SERVER_ONLY_PKGS,
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  plugins: [
    emptyServerModules(),
    goModeRedirects(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    viteReact(),
  ],
})
