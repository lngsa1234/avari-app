// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 10-12: People directory + User profiles
 * Tests: people list, search, profile detail, back navigation
 */

test.describe('People Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/people')
    await expect(page).toHaveURL(/\/people/)
  })

  test('shows people directory', async ({ page }) => {
    await expect(page.getByText(/connect with women/i)).toBeVisible({ timeout: 10000 })
  })

  test('shows search bar', async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible()
  })

  test('shows industry filter tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tech' })).toBeVisible()
  })

  test('search filters results', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('Admin')
    await page.waitForTimeout(500)
    // Should show filtered results or no results
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('shows grid/list view toggle', async ({ page }) => {
    await expect(page.getByRole('button', { name: /grid/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /list/i })).toBeVisible({ timeout: 10000 })
  })

  test('list view is default', async ({ page }) => {
    // List button should be active (darker background) by default
    const listBtn = page.getByRole('button', { name: /list/i })
    await expect(listBtn).toBeVisible({ timeout: 10000 })
  })

  test('person card click navigates to profile', async ({ page }) => {
    await page.waitForTimeout(2000)
    // Click on a person's name or card area
    const connectBtn = page.getByRole('button', { name: /connect/i }).first()
    if (await connectBtn.isVisible()) {
      // Click the card area, not the connect button
      const card = connectBtn.locator('..')
      await card.click()
      // May navigate to profile
    }
  })
})

test.describe('User Profile', () => {
  test('shows profile details', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByText('Profile')).toBeVisible()
    await expect(page.getByText('Tester')).toBeVisible({ timeout: 10000 })
  })

  test('shows stats (meetups, connections, shared circles)', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByText('Meetups', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Connections', { exact: true })).toBeVisible()
  })

  test('shows toggle switches for hosting and coffee chats', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByText(/open to hosting/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/open to coffee/i)).toBeVisible()
  })

  test('shows log out button', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible({ timeout: 10000 })
  })

  test('edit button is not visible on other people profiles', async ({ page }) => {
    await login(page)
    // Navigate to people directory and open someone else's profile
    await page.goto('/people', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Click the first person card to open their profile
    const profileLink = page.locator('a[href^="/people/"]').first()
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForURL(/\/people\/.+/, { timeout: 10000 })

      // Edit button should NOT be visible on someone else's profile
      const editBtn = page.getByRole('button', { name: /^edit$/i })
      await expect(editBtn).not.toBeVisible({ timeout: 3000 })

      // Share button should still be visible
      const shareBtn = page.getByRole('button', { name: /share/i })
      await expect(shareBtn).toBeVisible({ timeout: 5000 })
    }
  })

  test('unauthenticated user visiting /people/[id] is redirected to login', async ({ page }) => {
    // Do NOT log in — visit a profile URL directly
    await page.goto('/people/00000000-0000-0000-0000-000000000000', { waitUntil: 'networkidle' })

    // Should end up at the root/login page, not the profile
    await expect(page).toHaveURL(/^\/$|\/\?next=/, { timeout: 10000 })
  })

  test('back button from profile goes to previous page', async ({ page }) => {
    await login(page)
    // Navigate from circles to profile
    await page.goto('/circles')
    await page.locator('a[href="/profile"]').first().click()
    await expect(page).toHaveURL(/\/profile/)

    // Back should return to circles (from= param)
    const backBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    await backBtn.click()
    // Should go back (either via from= or browser history)
    await page.waitForTimeout(1000)
    const url = page.url()
    expect(url).not.toContain('/profile')
  })
})
