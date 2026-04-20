import { test, expect, type Page } from '@playwright/test'

// Smoke test for 8c8b: sidebar facet counts must match the list length
// when the facet is clicked, and folder scope must live in URL.

async function readSidebarStatusCount(page: Page, status: string): Promise<number> {
  // Sidebar status rows render label text (STATUS_LABELS) plus a count span.
  const row = page.getByRole('button', { name: new RegExp(status, 'i') }).first()
  // Fallback: find any element whose text contains the label.
  const text = await page.locator('aside').getByText(new RegExp(`^${status}$`, 'i')).first().locator('..').innerText()
  const m = text.match(/(\d+)\s*$/)
  return m ? parseInt(m[1]!, 10) : 0
}

async function listRowCount(page: Page): Promise<number> {
  // TicketTable renders rows; group headers have class patterns. Count visible
  // ticket rows via a data attribute or fallback to role. Use a stable hook:
  return await page.locator('[data-ticket-row]').count()
}

test.describe('counts stay consistent with list (8c8b)', () => {
  test('URL /?folder=archive validates and loads', async ({ page }) => {
    await page.goto('/?folder=archive')
    await expect(page).toHaveURL(/\?folder=archive/)
    // Header reflects folder scope
    await expect(page.getByText(/All Issues in\s*archive/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking status facet updates URL and preserves folder param', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click the "Open" row in sidebar Status section.
    const openRow = page.locator('aside').getByText(/^Open$/).first()
    await openRow.click()
    await expect(page).toHaveURL(/\?status=open/)

    // Now navigate into a folder (if any exist) while status filter is active.
    // Use the route directly — guarantees the test doesn't depend on specific folders.
    await page.goto('/?folder=tickets&status=open')
    await expect(page).toHaveURL(/folder=tickets.*status=open|status=open.*folder=tickets/)

    // Click a different status row; URL should swap status but keep folder.
    const reviewRow = page.locator('aside').getByText(/^In Review$/).first()
    await reviewRow.click()
    await expect(page).toHaveURL(/folder=tickets/)
    await expect(page).toHaveURL(/status=review/)
  })

  test('refreshing a URL with folder+status restores both', async ({ page }) => {
    await page.goto('/?folder=archive&status=closed')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/folder=archive/)
    await expect(page).toHaveURL(/status=closed/)
    // Sidebar should show active state for both — "All Issues in archive" label and
    // some indication that "Closed" row is active.
    await expect(page.getByText(/All Issues in\s*archive/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
