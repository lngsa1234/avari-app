/**
 * Test account definitions for multi-user E2E testing.
 * Credentials from env vars with fallback to defaults.
 */

const accounts = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'rewardly30@gmail.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'Huwang610198$r',
    role: 'admin',
  },
  member: {
    email: process.env.E2E_MEMBER_EMAIL || 'circlewtest@gmail.com',
    password: process.env.E2E_MEMBER_PASSWORD || 'Huwang610198$c',
    role: 'member',
  },
}

/**
 * Login as a specific account.
 * @param {import('@playwright/test').Page} page
 * @param {'admin'|'member'} account - which test account to use
 */
async function loginAs(page, account = 'admin') {
  const { email, password } = accounts[account]
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /already have an account/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await page.waitForURL('**/home', { timeout: 15000 })
}

module.exports = { accounts, loginAs }
