import { test, expect } from '@playwright/test'

test.describe('multi-tab SSE connection exhaustion', () => {
  test('4 tabs load concurrently without blocking', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })

    // Open 4 tabs simultaneously
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ])

    // Navigate all 4 at once — each should load within 15s
    const results = await Promise.allSettled(
      pages.map(async (page, i) => {
        const start = Date.now()
        await page.goto('/', { timeout: 15000, waitUntil: 'domcontentloaded' })
        // Wait for app shell to render
        await page.waitForSelector('text=tix', { timeout: 10000 })
        return Date.now() - start
      })
    )

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!
      expect(r.status, `Tab ${i + 1} should load`).toBe('fulfilled')
      if (r.status === 'fulfilled') {
        expect(r.value, `Tab ${i + 1} should load in under 15s`).toBeLessThan(15000)
      }
    }

    await context.close()
  })
})
