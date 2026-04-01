// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 8-9: Circles page + Circle detail
 * Tests: circles list, circle detail, join flow, back navigation
 */

test.describe('Circles Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: /circles/i }).click()
    await expect(page).toHaveURL(/\/circles/)
  })

  test('shows circles page sections', async ({ page }) => {
    await expect(page.getByText(/circles/i).first()).toBeVisible()
  })

  test('shows My Connections section', async ({ page }) => {
    await expect(page.getByText(/my connections/i)).toBeVisible({ timeout: 10000 })
  })

  test('shows My Active Circles section', async ({ page }) => {
    await expect(page.getByText(/my active circles/i)).toBeVisible({ timeout: 10000 })
  })

  test('circle card navigates to circle detail', async ({ page }) => {
    // Wait for circles to load, click "Get Started" or "Open Circle"
    const circleAction = page.getByRole('button', { name: /get started|open circle/i }).first()
    await expect(circleAction).toBeVisible({ timeout: 10000 })
    await circleAction.click()
    await expect(page).toHaveURL(/\/circles\/[a-f0-9-]+/)
  })

  test('"Create a Circle" button is visible', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Create a Circle")')
    await expect(createBtn).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Circle Detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: /circles/i }).click()
    // Navigate to first circle
    const circleAction = page.getByRole('button', { name: /get started|open circle/i }).first()
    await expect(circleAction).toBeVisible({ timeout: 10000 })
    await circleAction.click()
    await expect(page).toHaveURL(/\/circles\/[a-f0-9-]+/)
  })

  test('shows circle detail with members', async ({ page }) => {
    await expect(page.getByText(/members/i)).toBeVisible({ timeout: 10000 })
  })

  test('back button returns to circles page', async ({ page }) => {
    // Click the back chevron
    await page.locator('button').filter({ has: page.locator('svg') }).first().click()
    await expect(page).toHaveURL(/\/circles/)
  })

  test('shows chat and leave buttons for members', async ({ page }) => {
    await expect(page.getByRole('button', { name: /chat/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /leave/i })).toBeVisible()
  })
})

test.describe('Circle Detail - Back Navigation', () => {
  test('back goes to home when navigated from home', async ({ page }) => {
    await login(page)
    // Navigate to a circle from home page
    await page.waitForTimeout(2000)
    const circleCard = page.locator('text=Join').first()
    if (await circleCard.isVisible()) {
      await circleCard.click()
      if (await page.url().match(/\/circles\/[a-f0-9-]+/)) {
        // Back should go to home (from= param)
        await page.locator('button').filter({ has: page.locator('svg') }).first().click()
        await expect(page).toHaveURL(/\/home/)
      }
    }
  })
})
