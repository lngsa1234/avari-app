// @ts-check
const { test, expect } = require('@playwright/test')
const { loginAs } = require('./helpers/accounts')

/**
 * Exploration: Connection request flow between two test accounts.
 * No assertions — just navigate, act, screenshot, and report what happened.
 *
 * Based on USER_JOURNEYS.md Journey 10 (User Profile) and Journey 12 (People Directory)
 *
 * Run: npx playwright test e2e/qa-connect.spec.js
 */

test.describe.serial('Explore: Connection request flow', () => {
  test('Step 1: Admin navigates to member profile and clicks Connect', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await loginAs(page, 'admin')

    // Go to People page
    await page.goto('/people', { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/explore-01-people-page.png', fullPage: true })

    // Click Tester2 to go to their profile
    const tester2 = page.locator('text=Tester2').first()
    if (await tester2.isVisible().catch(() => false)) {
      await tester2.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/explore-02-tester2-profile.png', fullPage: true })

      // Click Connect on profile page
      const connectBtn = page.locator('button', { hasText: /Connect/ }).first()
      if (await connectBtn.isVisible().catch(() => false)) {
        const btnText = await connectBtn.textContent()
        console.log(`Connect button text before click: "${btnText}"`)

        await connectBtn.click()
        await page.waitForTimeout(2000)
        await page.screenshot({ path: 'test-results/explore-03-after-connect.png', fullPage: true })

        const newBtnText = await page.locator('button', { hasText: /Connect|Request|Pending|Sent|Message/ }).first().textContent().catch(() => 'not found')
        console.log(`Button text after click: "${newBtnText}"`)
      } else {
        console.log('No Connect button found — may already be connected')
        await page.screenshot({ path: 'test-results/explore-03-no-connect-btn.png', fullPage: true })
      }
    } else {
      console.log('Tester2 not found on People page')
    }

    await page.close()
  })

  test('Step 2: Member checks home page for incoming request', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await loginAs(page, 'member')

    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/explore-04-member-home.png', fullPage: true })

    // Check what sections are visible
    const sections = ['Requests waiting for you', 'Your Coffee Chats', 'People to Meet', 'Live Feed']
    for (const section of sections) {
      const visible = await page.locator(`text=${section}`).isVisible().catch(() => false)
      console.log(`Section "${section}": ${visible ? 'VISIBLE' : 'not found'}`)
    }

    // Scroll down to see all content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/explore-05-member-home-scrolled.png', fullPage: true })

    await page.close()
  })

  test('Step 3: Member checks People page for admin', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await loginAs(page, 'member')

    await page.goto('/people', { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/explore-06-member-people.png', fullPage: true })

    // Look for the admin account
    const adminUser = page.locator('text=Tester').first()
    if (await adminUser.isVisible().catch(() => false)) {
      console.log('Found admin user on member People page')
      // Check if they show as "Connect" or "Requested" or "Connected"
      const row = adminUser.locator('xpath=ancestor::div[.//button]').first()
      const rowText = await row.textContent().catch(() => '')
      console.log(`Admin row content: ${rowText?.substring(0, 100)}`)
    }

    await page.close()
  })

  test('Step 4: Check both users Circles page state', async ({ browser }) => {
    const adminCtx = await browser.newContext()
    const memberCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    const memberPage = await memberCtx.newPage()

    await loginAs(adminPage, 'admin')
    await loginAs(memberPage, 'member')

    await adminPage.getByRole('link', { name: /circles/i }).click()
    await memberPage.getByRole('link', { name: /circles/i }).click()
    await adminPage.waitForTimeout(3000)
    await memberPage.waitForTimeout(3000)

    await adminPage.screenshot({ path: 'test-results/explore-07-admin-circles.png', fullPage: true })
    await memberPage.screenshot({ path: 'test-results/explore-08-member-circles.png', fullPage: true })

    // Log what each user sees
    for (const [name, page] of [['Admin', adminPage], ['Member', memberPage]]) {
      const bodyText = await page.textContent('body')
      const hasConnections = !bodyText?.includes('No connections yet')
      const hasSentRequests = bodyText?.includes('Sent Requests')
      const hasPending = bodyText?.includes('Pending')
      const hasCircles = bodyText?.includes('My Active Circles')
      console.log(`${name}: connections=${hasConnections}, sentRequests=${hasSentRequests}, pending=${hasPending}, circles=${hasCircles}`)
    }

    await adminCtx.close()
    await memberCtx.close()
  })
})
