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

test.describe('escape key in detail panel', () => {
  let testTicketId: string

  test.beforeAll(() => {
    const out = tix('create', '--title', 'Escape Key Test', '--type', 'task', '--priority', '2')
    const match = out.match(/[a-f0-9]{4}/)
    if (!match) throw new Error(`Could not extract id from: ${out}`)
    testTicketId = match[0]
  })

  test.afterAll(() => {
    try { tix('close', testTicketId) } catch { /* ignore */ }
  })

  test('first escape blurs editable, second escape closes panel', async ({ page }) => {
    await page.goto('/')

    // Click the ticket to open the detail panel
    const row = page.locator(`[data-ticket-row="${testTicketId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    // Wait for the detail panel to appear (not the sidebar aside)
    const panel = page.locator('aside.border-l')
    await expect(panel).toBeVisible({ timeout: 5_000 })

    // Focus the title input inside the panel
    const titleInput = panel.locator('[aria-label="Ticket title (editable)"]')
    await expect(titleInput).toBeVisible({ timeout: 5_000 })
    await titleInput.focus()
    await expect(titleInput).toBeFocused()

    // First Escape: blurs the input, panel stays open
    await page.keyboard.press('Escape')
    await expect(titleInput).not.toBeFocused()
    await expect(panel).toBeVisible()

    // Second Escape: closes the panel
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible()
  })
})
