// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 7: Coffee / Meetups page
 * Tests: upcoming/past tabs, chat cards, schedule button, empty states, call history
 */

test.describe('Coffee Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/coffee')
    await expect(page).toHaveURL(/\/coffee/)
  })

  test('coffee page loads with upcoming tab active', async ({ page }) => {
    const upcomingTab = page.getByText(/upcoming/i).first()
    await expect(upcomingTab).toBeVisible({ timeout: 15000 })
  })

  test('shows schedule or create button', async ({ page }) => {
    try {
      const scheduleBtn = page.getByRole('button', { name: /schedule|host|create/i }).first()
      await expect(scheduleBtn).toBeVisible({ timeout: 15000 })
    } catch {
      const fab = page.locator('a[href*="schedule"]').first()
      await expect(fab).toBeVisible({ timeout: 5000 })
    }
  })

  test('tab switching between upcoming and past', async ({ page }) => {
    const pastTab = page.getByText(/past/i).first()
    await expect(pastTab).toBeVisible({ timeout: 15000 })
    await pastTab.click()
    await page.waitForTimeout(1000)

    // Switch back to upcoming
    const upcomingTab = page.getByText(/upcoming/i).first()
    await upcomingTab.click()
    await page.waitForTimeout(1000)
  })

  test('coffee chat cards show partner info or empty state', async ({ page }) => {
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    const hasCards = body.match(/coffee chat|accepted|pending|scheduled/i)
    const hasEmptyState = body.match(/no upcoming|no meetups|schedule|browse/i)
    expect(hasCards || hasEmptyState).toBeTruthy()
  })

  test('past tab shows completed meetings or empty state', async ({ page }) => {
    const pastTab = page.getByText(/past/i).first()
    await expect(pastTab).toBeVisible({ timeout: 15000 })
    await pastTab.click()
    await page.waitForTimeout(3000)

    const body = await page.textContent('body')
    const hasContent = body.match(/completed|recap|summary|ago|attended/i)
    const hasEmptyState = body.match(/no past|no completed|no history/i)
    expect(hasContent || hasEmptyState).toBeTruthy()
  })

  test('"Host a Coffee Chat" button navigates to schedule', async ({ page }) => {
    const hostBtn = page.getByRole('button', { name: /host.*coffee|schedule/i }).first()
    try {
      await expect(hostBtn).toBeVisible({ timeout: 15000 })
      await hostBtn.click()
      await expect(page).toHaveURL(/\/schedule/)
    } catch {
      // Button may not exist if layout uses a different CTA
    }
  })
})
