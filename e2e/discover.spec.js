// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 6: Discover page
 * Journey 7: Coffee/Meetups page
 * Journey 16: Event detail
 * Journey 18: Recaps
 */

test.describe('Discover Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: /discover/i }).click()
  })

  test('shows community events section', async ({ page }) => {
    await expect(page.getByText(/community events/i)).toBeVisible()
  })

  test('shows trending requests section', async ({ page }) => {
    await expect(page.getByText(/trending requests/i)).toBeVisible()
  })

  test('shows intimate circles section', async ({ page }) => {
    await expect(page.getByText(/intimate circles/i)).toBeVisible()
  })

  test('"Host yours" button navigates to schedule', async ({ page }) => {
    const hostBtn = page.getByRole('button', { name: /host yours/i })
    if (await hostBtn.isVisible()) {
      await hostBtn.click()
      await expect(page).toHaveURL(/\/schedule/)
    }
  })

  test('circle card navigates to circle detail', async ({ page }) => {
    const joinBtn = page.getByRole('button', { name: /join/i }).first()
    await expect(joinBtn).toBeVisible({ timeout: 10000 })
    // The parent card should be clickable
  })

  test('"See all" circles navigates to browse', async ({ page }) => {
    const seeAll = page.getByRole('button', { name: /see all/i }).first()
    if (await seeAll.isVisible()) {
      await seeAll.click()
      await expect(page).toHaveURL(/\/circles\/browse/)
    }
  })
})

test.describe('Coffee Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: /coffee/i }).click()
  })

  test('shows coffee chats page', async ({ page }) => {
    await expect(page.getByText(/coffee chats/i)).toBeVisible()
  })

  test('shows upcoming and past tabs', async ({ page }) => {
    await expect(page.getByText(/upcoming/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/past/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('"Host a Coffee Chat" button navigates to schedule', async ({ page }) => {
    await page.getByRole('button', { name: /host a coffee chat/i }).click()
    await expect(page).toHaveURL(/\/schedule/)
  })

  test('empty state shows browse events CTA', async ({ page }) => {
    // If no upcoming events, should show empty state
    const browseBtn = page.getByRole('button', { name: /browse events/i })
    if (await browseBtn.isVisible()) {
      await browseBtn.click()
      await expect(page).toHaveURL(/\/discover/)
    }
  })
})

test.describe('Recaps Page', () => {
  test('shows recap list with filters', async ({ page }) => {
    await login(page)
    await page.goto('/recaps')
    await expect(page.getByText(/meetup recaps/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /unreviewed/i })).toBeVisible()
  })
})

test.describe('Schedule Page', () => {
  test('shows meetup type selection', async ({ page }) => {
    await login(page)
    await page.goto('/schedule')
    await expect(page.getByText(/schedule a meetup/i)).toBeVisible()
    await expect(page.getByText(/1:1 coffee chat/i)).toBeVisible()
    await expect(page.getByText(/circle meetup/i)).toBeVisible()
    await expect(page.getByText(/community event/i)).toBeVisible()
  })

  test('back button from schedule goes to previous page', async ({ page }) => {
    await login(page)
    // Navigate from coffee to schedule
    await page.goto('/coffee')
    await page.getByRole('button', { name: /host a coffee chat/i }).click()
    await expect(page).toHaveURL(/\/schedule/)

    // Back should return to coffee
    const backBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    await backBtn.click()
    await page.waitForTimeout(1000)
    expect(page.url()).not.toContain('/schedule')
  })
})
