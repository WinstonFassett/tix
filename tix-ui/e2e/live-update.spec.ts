import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// Regression test for d0ca: after the TanStack Start migration, editing a
// ticket file on disk was no longer reflected in the UI without a hard
// refresh. This test guards the live-update path: vite plugin fs.watch -> HMR
// custom event "tickets-update" -> client-side queryClient.invalidateQueries.

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspace = path.resolve(__dirname, '..', '..')
const ticketsDir = path.join(workspace, 'tickets')

function tix(...args: string[]): string {
  return execFileSync(path.join(workspace, 'tix'), args, {
    cwd: workspace,
    encoding: 'utf-8',
  })
}

function findTicketFile(id: string): string {
  const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
  const found = entries.find(f => f.includes(`(${id})`))
  if (!found) throw new Error(`Ticket ${id} not found on disk`)
  return path.join(ticketsDir, found)
}

test.describe('live updates', () => {
  let testTicketId: string

  test.beforeAll(() => {
    // Create a dedicated ticket we'll mutate during the test.
    const out = tix('create', 'Live Update Regression Probe')
    const m = out.match(/([a-f0-9]{4})/)
    if (!m) throw new Error(`Could not parse ticket id from: ${out}`)
    testTicketId = m[1]!
  })

  test.afterAll(() => {
    // Clean up: close archives the ticket.
    try { tix('close', testTicketId) } catch { /* ignore */ }
  })

  test('edit on disk updates the list view without reload', async ({ page }) => {
    await page.goto('/')

    // Wait until the probe ticket is rendered.
    const originalTitle = 'Live Update Regression Probe'
    await expect(page.getByText(originalTitle).first()).toBeVisible({ timeout: 15_000 })

    // Mutate the title on disk via tix CLI (no UI interaction).
    const newTitle = 'Live Update Regression Probe UPDATED'
    tix('rename', testTicketId, newTitle)

    // The updated title must appear without any navigation or reload.
    await expect(page.getByText(newTitle).first()).toBeVisible({ timeout: 8_000 })
  })

  test('create on disk shows up in list view without reload', async ({ page }) => {
    await page.goto('/')
    // Wait for an existing ticket to render, confirming initial data load.
    await expect(page.getByText('Live Update Regression Probe').first()).toBeVisible({ timeout: 15_000 })

    const uniqueTitle = `Appear Live ${Date.now().toString(36)}`
    const out = tix('create', uniqueTitle)
    const m = out.match(/([a-f0-9]{4})/)
    const newId = m?.[1]
    if (!newId) throw new Error(`Could not parse id: ${out}`)

    try {
      await expect(page.getByText(uniqueTitle).first()).toBeVisible({ timeout: 8_000 })
    } finally {
      try { tix('close', newId) } catch { /* ignore */ }
    }
  })
})
