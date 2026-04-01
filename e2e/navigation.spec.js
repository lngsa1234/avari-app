// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 5: Home page navigation
 * Journey cross-cutting: Nav bar, tab switching, back navigation
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('home page loads with greeting', async ({ page }) => {
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
  })

  test('nav tabs switch between main pages', async ({ page }) => {
    // Home → Discover
    await page.getByRole('link', { name: /discover/i }).click()
    await expect(page).toHaveURL(/\/discover/)
    await expect(page.getByText(/community events/i)).toBeVisible()

    // Discover → Coffee
    await page.getByRole('link', { name: /coffee/i }).click()
    await expect(page).toHaveURL(/\/coffee/)
    await expect(page.getByText(/coffee chats/i)).toBeVisible()

    // Coffee → Circles
    await page.getByRole('link', { name: /circles/i }).click()
    await expect(page).toHaveURL(/\/circles/)
    await expect(page.getByText(/circles/i)).toBeVisible()

    // Circles → Home
    await page.getByRole('link', { name: /home/i }).click()
    await expect(page).toHaveURL(/\/home/)
  })

  test('avatar navigates to profile', async ({ page }) => {
    // Click the avatar/initial in top right
    await page.locator('a[href="/profile"]').first().click()
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('Profile')).toBeVisible()
  })

  test('logo navigates to home', async ({ page }) => {
    await page.getByRole('link', { name: /discover/i }).click()
    await page.getByRole('link', { name: /circlew/i }).first().click()
    await expect(page).toHaveURL(/\/home/)
  })

  test('browser back button works between pages', async ({ page }) => {
    await page.getByRole('link', { name: /discover/i }).click()
    await expect(page).toHaveURL(/\/discover/)

    await page.goBack()
    await expect(page).toHaveURL(/\/home/)
  })
})
