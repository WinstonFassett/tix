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

test.describe('drag-and-drop', () => {
  let testTicketId: string

  test.beforeAll(() => {
    const out = tix('create', '--title', 'DnD Test Ticket', '--type', 'task', '--priority', '2')
    const match = out.match(/[a-f0-9]{4}/)
    if (!match) throw new Error(`Could not extract id from: ${out}`)
    testTicketId = match[0]
  })

  test.afterAll(() => {
    try { tix('close', testTicketId) } catch { /* ignore */ }
  })

  test('list rows are visible with correct opacity', async ({ page }) => {
    await page.goto('/')
    const firstRow = page.locator('[data-ticket-row]').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await expect(firstRow).toHaveCSS('opacity', '1')
  })

  test('list rows show drag handles', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('DnD Test Ticket').first()).toBeVisible({ timeout: 15_000 })
    const gripHandles = page.locator('[data-ticket-row] .lucide-grip-vertical')
    await expect(gripHandles.first()).toBeVisible()
  })

  test('kanban board renders with draggable cards', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Display' }).click()
    await page.getByText('Board').click()
    await page.keyboard.press('Escape')

    const card = page.getByText('DnD Test Ticket').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
  })
})
