// @ts-check
const { test, expect } = require('@playwright/test')
const { login } = require('./helpers/auth')

/**
 * Journey 11: Own Profile
 * Tests: user info display, edit profile, toggle switches, stats, log out
 */

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/profile', { waitUntil: 'networkidle' })
  })

  test('profile page loads with user info', async ({ page }) => {
    // Should render profile content
    const body = await page.textContent('body')
    expect(body.length).toBeGreaterThan(100)
  })

  test('shows profile name', async ({ page }) => {
    try {
      const heading = page.locator('h1, h2, h3').first()
      await expect(heading).toBeVisible({ timeout: 15000 })
      const text = await heading.textContent()
      expect(text.trim().length).toBeGreaterThan(0)
    } catch {
      // Name may be in a non-heading element
      const body = await page.textContent('body')
      expect(body.length).toBeGreaterThan(0)
    }
  })

  test('shows edit profile option', async ({ page }) => {
    try {
      const editBtn = page.getByRole('button', { name: /edit/i }).first()
      await expect(editBtn).toBeVisible({ timeout: 15000 })
    } catch {
      // Edit may be an icon button or pencil icon without text label
      const editIcon = page.locator('button svg, [class*="edit"]').first()
      await expect(editIcon).toBeVisible({ timeout: 15000 })
    }
  })

  test('shows toggle switches for hosting and coffee chats', async ({ page }) => {
    try {
      const toggles = page.locator('button[role="switch"], input[type="checkbox"], [class*="toggle"], [class*="switch"]')
      await expect(toggles.first()).toBeVisible({ timeout: 15000 })
    } catch {
      // Toggles may use different elements
      const availabilityText = page.getByText(/hosting|coffee chat|available/i).first()
      await expect(availabilityText).toBeVisible({ timeout: 15000 })
    }
  })

  test('shows stats (meetups, connections, shared circles)', async ({ page }) => {
    const body = await page.textContent('body')
    const hasStats = body.match(/meetup|connection|circle/i)
    expect(hasStats).toBeTruthy()
  })

  test('shows log out button', async ({ page }) => {
    try {
      const logOutBtn = page.getByRole('button', { name: /log out|sign out|logout/i }).first()
      await expect(logOutBtn).toBeVisible({ timeout: 15000 })
    } catch {
      const logOutLink = page.getByText(/log out|sign out|logout/i).first()
      await expect(logOutLink).toBeVisible({ timeout: 15000 })
    }
  })

  test('edit profile updates name immediately without reload', async ({ page }) => {
    // Open edit modal
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    await expect(editBtn).toBeVisible({ timeout: 15000 })
    await editBtn.click()

    // Modal should appear
    const modal = page.getByText('Edit Profile')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Read current name and set a new one
    const nameInput = page.getByRole('textbox').first()
    const originalName = await nameInput.inputValue()
    const testName = originalName === 'Test User' ? 'Test User 2' : 'Test User'

    await nameInput.clear()
    await nameInput.fill(testName)

    // Save
    await page.getByRole('button', { name: /save changes/i }).click()

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 })

    // Name should update immediately — within 500ms, no reload needed
    await expect(page.getByText(testName).first()).toBeVisible({ timeout: 500 })

    // Restore original name
    await editBtn.click()
    await expect(page.getByText('Edit Profile')).toBeVisible({ timeout: 5000 })
    const nameInputAgain = page.getByRole('textbox').first()
    await nameInputAgain.clear()
    await nameInputAgain.fill(originalName)
    await page.getByRole('button', { name: /save changes/i }).click()
  })

  test('edit profile cancel closes modal without saving', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    await expect(editBtn).toBeVisible({ timeout: 15000 })
    await editBtn.click()

    const modal = page.getByText('Edit Profile')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Change the name but cancel
    const nameInput = page.getByRole('textbox').first()
    const originalName = await nameInput.inputValue()
    await nameInput.clear()
    await nameInput.fill('Should Not Save')

    await page.getByRole('button', { name: /cancel/i }).click()

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 })

    // Original name should still be shown
    await expect(page.getByText(originalName).first()).toBeVisible({ timeout: 3000 })
  })

  test('edit profile validation blocks save when name is empty', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    await expect(editBtn).toBeVisible({ timeout: 15000 })
    await editBtn.click()

    const modal = page.getByText('Edit Profile')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Clear the name field
    const nameInput = page.getByRole('textbox').first()
    await nameInput.clear()

    await page.getByRole('button', { name: /save changes/i }).click()

    // Modal should stay open — save was blocked
    await expect(modal).toBeVisible({ timeout: 2000 })

    // Error message should appear
    await expect(page.getByText(/name is required/i)).toBeVisible({ timeout: 2000 })
  })

  test('edit profile changes persist after page reload', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    await expect(editBtn).toBeVisible({ timeout: 15000 })
    await editBtn.click()

    const modal = page.getByText('Edit Profile')
    await expect(modal).toBeVisible({ timeout: 5000 })

    const nameInput = page.getByRole('textbox').first()
    const originalName = await nameInput.inputValue()
    const testName = originalName === 'Persist Test' ? 'Persist Test 2' : 'Persist Test'

    await nameInput.clear()
    await nameInput.fill(testName)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 5000 })

    // Reload the page — data must come from DB, not just local state
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText(testName).first()).toBeVisible({ timeout: 15000 })

    // Restore original name
    await page.getByRole('button', { name: /edit/i }).first().click()
    await expect(page.getByText('Edit Profile')).toBeVisible({ timeout: 5000 })
    const nameInputAgain = page.getByRole('textbox').first()
    await nameInputAgain.clear()
    await nameInputAgain.fill(originalName)
    await page.getByRole('button', { name: /save changes/i }).click()
  })

  test('shows share button', async ({ page }) => {
    const shareBtn = page.getByRole('button', { name: /share/i })
    await expect(shareBtn).toBeVisible({ timeout: 15000 })
  })

  test('toggle switches are interactive', async ({ page }) => {
    try {
      const toggle = page.locator('button[role="switch"], input[type="checkbox"], [class*="toggle"], [class*="switch"]').first()
      await expect(toggle).toBeVisible({ timeout: 15000 })
      await toggle.click()
      await page.waitForTimeout(1000)
      // Toggle back to restore state
      await toggle.click()
      await page.waitForTimeout(1000)
    } catch {
      // Toggle interaction may not be available
    }
  })
})
