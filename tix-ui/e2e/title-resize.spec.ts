import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspace = path.resolve(__dirname, '..', '..')

function tix(...args: string[]): string {
  return execFileSync(path.join(workspace, 'tix'), args, {
    cwd: workspace,
    encoding: 'utf-8',
  })
}

test.describe('title auto-resize textarea', () => {
  let testTicketId: string

  test.beforeAll(() => {
    const longTitle = 'This is a very long ticket title that should definitely wrap to multiple lines in the detail panel textarea input'
    const out = tix('create', '--title', longTitle, '--type', 'task', '--priority', '2')
    const match = out.match(/[a-f0-9]{4}/)
    if (!match) throw new Error(`Could not extract id from: ${out}`)
    testTicketId = match[0]
  })

  test.afterAll(() => {
    try { tix('close', testTicketId) } catch { /* ignore */ }
  })

  test('textarea grows to fit long title', async ({ page }) => {
    await page.goto('/')

    // Click the ticket to open the detail panel
    const row = page.locator(`[data-ticket-row="${testTicketId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    // Wait for detail panel
    const panel = page.locator('aside.border-l')
    await expect(panel).toBeVisible({ timeout: 5_000 })

    // The title should be a textarea, not an input
    const titleTextarea = panel.locator('textarea[aria-label="Ticket title (editable)"]')
    await expect(titleTextarea).toBeVisible({ timeout: 5_000 })

    // The textarea height should be greater than a single line (~44px for text-2xl)
    const height = await titleTextarea.evaluate(el => el.getBoundingClientRect().height)
    expect(height).toBeGreaterThan(50)
  })
})
