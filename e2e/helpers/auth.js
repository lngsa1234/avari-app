/**
 * Shared auth helper for E2E tests.
 * Logs in with the test account and navigates to the app.
 */

async function login(page, email = 'rewardly30@gmail.com', password = 'Huwang610198$r') {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /already have an account/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  // Wait for home page to load
  await page.waitForURL('**/home', { timeout: 15000 })
}

module.exports = { login }
