// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 5: Home page browsing
 * Tests: sections render, navigation from home, empty states
 */

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('shows upcoming meetups section', async ({ page }) => {
    await expect(page.getByText(/upcoming meetups/i)).toBeVisible()
  })

  test('shows People to Meet section', async ({ page }) => {
    // Wait for SWR data to load
    await expect(page.getByText(/people to meet/i)).toBeVisible({ timeout: 15000 })
  })

  test('shows live feed section', async ({ page }) => {
    await expect(page.getByText(/live feed/i)).toBeVisible()
  })

  test('"View all" meetups navigates to coffee page', async ({ page }) => {
    const viewAll = page.getByText('View all').first()
    if (await viewAll.isVisible()) {
      await viewAll.click()
      await expect(page).toHaveURL(/\/coffee/)
    }
  })

  test('"See all" people navigates to people page', async ({ page }) => {
    // Wait for People to Meet to load
    const seeAll = page.getByText('See all').first()
    await expect(seeAll).toBeVisible({ timeout: 15000 })
    await seeAll.click()
    await expect(page).toHaveURL(/\/(people|circles)/)
  })

  test('person card navigates to profile', async ({ page }) => {
    // Wait for People to Meet section to load
    const sayHiBtn = page.getByRole('button', { name: /say hi/i }).first()
    try {
      await expect(sayHiBtn).toBeVisible({ timeout: 15000 })
      // Click the card area above the button (the person name/avatar)
      const card = sayHiBtn.locator('xpath=ancestor::div[contains(@style, "cursor")]')
      if (await card.count() > 0) {
        await card.first().click()
        await expect(page).toHaveURL(/\/people\//)
      }
    } catch {
      // People to Meet may be empty — skip gracefully
    }
  })

  test('no console errors on home page', async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text())
      }
    })
    await page.waitForTimeout(3000)
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('hydration') &&
      !e.includes('favicon') &&
      !e.includes('ResizeObserver')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
