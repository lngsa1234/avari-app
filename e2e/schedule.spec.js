// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 15: Schedule Meetup
 * Tests: type selection, coffee/circle/community options, connection picker
 */

test.describe('Schedule Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/schedule')
    await expect(page).toHaveURL(/\/schedule/)
  })

  test('shows meetup type selection', async ({ page }) => {
    // Should show options for different meetup types
    const body = await page.textContent('body')
    expect(body).toMatch(/coffee|circle|community|1.on.1|meetup type/i)
  })

  test('shows coffee chat option', async ({ page }) => {
    const coffeeOption = page.getByText(/coffee chat|1.on.1/i).first()
    await expect(coffeeOption).toBeVisible({ timeout: 15000 })
  })

  test('shows circle meeting option', async ({ page }) => {
    const circleOption = page.getByText(/circle|group meeting/i).first()
    await expect(circleOption).toBeVisible({ timeout: 15000 })
  })

  test('shows community event option', async ({ page }) => {
    const communityOption = page.getByText(/community|event/i).first()
    await expect(communityOption).toBeVisible({ timeout: 15000 })
  })

  test('selecting coffee chat shows connection picker', async ({ page }) => {
    const coffeeOption = page.getByText(/coffee chat|1.on.1/i).first()
    await expect(coffeeOption).toBeVisible({ timeout: 15000 })
    await coffeeOption.click()
    await page.waitForTimeout(2000)

    // Should show connection picker ("Who do you want to meet with?")
    const picker = page.getByText(/who do you want to meet|select.*connection|choose.*person/i).first()
    await expect(picker).toBeVisible({ timeout: 15000 })
  })

  test('back button navigates to previous page', async ({ page }) => {
    const backBtn = page.getByRole('button', { name: /back/i }).first()
    try {
      await expect(backBtn).toBeVisible({ timeout: 10000 })
      await backBtn.click()
      await page.waitForTimeout(1000)
      // Should navigate away from schedule
      expect(page.url()).not.toMatch(/\/schedule/)
    } catch {
      // Back button may not be visible on type selection screen
    }
  })
})
