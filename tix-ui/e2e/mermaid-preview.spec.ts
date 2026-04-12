import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspace = path.resolve(__dirname, '..', '..')
const ticketsDir = path.join(workspace, 'tickets')

const MERMAID_CONTENT = `---
id: "e2e0"
title: "Mermaid e2e test"
status: open
deps: []
links: []
created: 2026-04-11T20:00:00Z
type: feature
priority: 3
tags: [test]
---
# Mermaid E2E Test

A flowchart:

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[Skip]
    C --> E[End]
    D --> E
\`\`\`
`

test.describe('mermaid preview', () => {
  const ticketFile = path.join(ticketsDir, 'Mermaid E2E Test (e2e0).md')

  test.beforeAll(() => {
    fs.mkdirSync(ticketsDir, { recursive: true })
    fs.writeFileSync(ticketFile, MERMAID_CONTENT, 'utf-8')
  })

  test.afterAll(() => {
    try { fs.unlinkSync(ticketFile) } catch {}
  })

  test('renders mermaid code block as SVG diagram', async ({ page }) => {
    // Collect console errors
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    // Load the dashboard first (ensures SSR hydration works)
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Then navigate to the mermaid ticket
    await page.goto('/ticket/e2e0')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/mermaid-debug.png', fullPage: true })

    // Wait for the ticket filename to appear (unambiguous selector)
    await expect(page.getByText('Mermaid E2E Test (e2e0).md')).toBeVisible({ timeout: 15000 })

    // The milkdown editor should be present
    await expect(page.locator('.milkdown')).toBeVisible({ timeout: 15000 })

    // Mermaid renders an SVG with node elements inside the editor
    const svg = page.locator('.milkdown svg')
    await expect(svg.first()).toBeVisible({ timeout: 20000 })

    // Verify the rendered SVG has actual diagram content (nodes, edges)
    const nodeCount = await page.locator('.milkdown svg .node').count()
    expect(nodeCount).toBeGreaterThanOrEqual(3)

    // Screenshot for visual verification
    await page.screenshot({
      path: 'e2e/screenshots/mermaid-preview.png',
      fullPage: true,
    })
  })
})
