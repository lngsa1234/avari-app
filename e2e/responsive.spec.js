// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Cross-cutting: Mobile responsive tests
 */

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('home page renders correctly on mobile', async ({ page }) => {
    await login(page)
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
    // Nav should still be visible
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible()
  })

  test('profile page renders correctly on mobile', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByText('Profile')).toBeVisible()
    await expect(page.getByText('Tester')).toBeVisible({ timeout: 10000 })
  })

  test('circles page renders correctly on mobile', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: /circles/i }).click()
    await expect(page.getByText(/circles/i).first()).toBeVisible()
  })

  test('nav tabs are accessible on mobile', async ({ page }) => {
    await login(page)
    // All 4 main tabs should be visible
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /discover/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /coffee/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /circles/i })).toBeVisible()
  })
})
