// @ts-check
const { test, expect } = require('@playwright/test')

/**
 * Journey 1-4: Authentication flows
 * Covers: landing page, email login, signup validation, forgot password
 */

test.describe('Landing Page', () => {
  test('shows login and signup options', async ({ page }) => {
    await page.goto('/')
    // Wait for React to hydrate and render the landing page
    await page.waitForSelector('button', { timeout: 20000 })
    await expect(page.getByText('CircleW')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign up with email/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /already have an account/i })).toBeVisible()
  })

  test('terms and privacy links work', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('link', { name: /terms/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /privacy/i })).toBeVisible()
  })
})

test.describe('Email Login', () => {
  test('shows login form when clicking log in', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /already have an account/i }).click()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /already have an account/i }).click()
    await page.getByPlaceholder('Email').fill('nonexistent@test.com')
    await page.getByPlaceholder('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /log in/i }).click()
    // Should show an error message
    await expect(page.getByText(/incorrect|invalid|error/i)).toBeVisible({ timeout: 5000 })
  })

  test('shows forgot password form', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /already have an account/i }).click()
    await page.getByRole('button', { name: /forgot password/i }).click()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible()
  })

  test('back button returns to login options', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /already have an account/i }).click()
    await page.getByRole('button', { name: /back/i }).click()
    await expect(page.getByRole('button', { name: /sign up with email/i })).toBeVisible()
  })
})

test.describe('Email Signup', () => {
  test('shows signup form', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /sign up with email/i }).click()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible()
  })

  test('validates empty fields', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /sign up with email/i }).click()
    await page.getByRole('button', { name: /sign up/i }).click()
    await expect(page.getByText(/please enter your email/i)).toBeVisible({ timeout: 3000 })
  })
})
