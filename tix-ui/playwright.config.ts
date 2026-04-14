import { defineConfig, devices } from '@playwright/test'

// Two modes:
//   MODE=dev   - run against vite dev server (default)
//   MODE=prod  - run against built Nitro server (node .output/server/index.mjs)
// Live updates must work in BOTH modes. The regression that spawned this
// test suite (ticket d0ca) only reproduces in prod mode.

const mode = process.env.MODE ?? 'dev'
const port = mode === 'prod' ? 3459 : 3458
const command = mode === 'prod'
  ? `node .output/server/index.mjs`
  : `bun run dev --port ${port}`
// Dev server uses HTTPS (self-signed cert for HTTP/2)
const protocol = mode === 'prod' ? 'http' : 'https'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `${protocol}://localhost:${port}`,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command,
    url: `${protocol}://localhost:${port}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      TIX_WORKSPACE: process.env.TIX_WORKSPACE || process.cwd() + '/../',
      PORT: String(port),
    },
  },
})
