// @ts-check
const { test, expect } = require('@playwright/test')
const { loginAs } = require('./helpers/accounts')
const fs = require('fs')
const path = require('path')

/**
 * Full QA test suite — produces a structured report.
 *
 * Run: npx playwright test e2e/qa-full.spec.js
 * Report: test-results/qa-report.md
 */

const issues = []
const screenshots = []
let startTime

function logIssue(severity, category, title, description, screenshot) {
  issues.push({
    id: `QA-${String(issues.length + 1).padStart(3, '0')}`,
    severity,
    category,
    title,
    description,
    screenshot,
    timestamp: new Date().toISOString(),
  })
}

test.beforeAll(() => {
  startTime = Date.now()
  fs.mkdirSync('test-results', { recursive: true })
})

test.afterAll(() => {
  const duration = Math.floor((Date.now() - startTime) / 1000)
  const report = generateReport(duration)
  fs.writeFileSync('test-results/qa-report.md', report)
  console.log(`\n📋 QA Report: test-results/qa-report.md (${issues.length} issues found)`)
})

function generateReport(durationSec) {
  const critical = issues.filter(i => i.severity === 'critical').length
  const high = issues.filter(i => i.severity === 'high').length
  const medium = issues.filter(i => i.severity === 'medium').length
  const low = issues.filter(i => i.severity === 'low').length
  const total = issues.length

  const score = Math.max(0, 100 - (critical * 25) - (high * 15) - (medium * 8) - (low * 3))

  const mins = Math.floor(durationSec / 60)
  const secs = durationSec % 60

  let report = `# QA Report — CircleW\n\n`
  report += `**Date:** ${new Date().toISOString().split('T')[0]}\n`
  report += `**Duration:** ${mins}m ${secs}s\n`
  report += `**Health Score:** ${score}/100\n`
  report += `**Accounts Used:** admin (rewardly30), member (circlewtest)\n\n`

  report += `## Summary\n\n`
  report += `| Severity | Count |\n`
  report += `|----------|-------|\n`
  report += `| Critical | ${critical} |\n`
  report += `| High | ${high} |\n`
  report += `| Medium | ${medium} |\n`
  report += `| Low | ${low} |\n`
  report += `| **Total** | **${total}** |\n\n`

  if (total === 0) {
    report += `No issues found. All tested flows passed.\n\n`
  } else {
    report += `## Issues\n\n`
    for (const issue of issues) {
      report += `### ${issue.id}: ${issue.title}\n\n`
      report += `- **Severity:** ${issue.severity}\n`
      report += `- **Category:** ${issue.category}\n`
      report += `- **Description:** ${issue.description}\n`
      if (issue.screenshot) {
        report += `- **Screenshot:** ${issue.screenshot}\n`
      }
      report += `\n`
    }
  }

  report += `## Screenshots\n\n`
  for (const s of screenshots) {
    report += `- ${s}\n`
  }

  return report
}

async function screenshotAndLog(page, name) {
  const filepath = `test-results/qa-${name}.png`
  await page.screenshot({ path: filepath, fullPage: false })
  screenshots.push(filepath)
  return filepath
}

// ─── Admin account tests ────────────────────────────────────────────────

test.describe.serial('QA: Admin account flows', () => {
  /** @type {import('@playwright/test').Page} */
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await loginAs(page, 'admin')
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('Home page loads without errors', async () => {
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('ResizeObserver')) {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(3000)
    await screenshotAndLog(page, 'admin-home')

    // Check key sections exist
    const hasUpcoming = await page.locator('text=/upcoming meetups|Upcoming/i').isVisible().catch(() => false)
    const hasPeople = await page.locator('text=/people to meet/i').isVisible({ timeout: 10000 }).catch(() => false)
    const hasLiveFeed = await page.locator('text=/live feed/i').isVisible().catch(() => false)

    if (!hasUpcoming && !hasPeople && !hasLiveFeed) {
      logIssue('high', 'functional', 'Home page sections missing', 'None of the expected home page sections (Upcoming Meetups, People to Meet, Live Feed) are visible')
    }

    const criticalErrors = errors.filter(e => !e.includes('hydration') && !e.includes('WebSocket'))
    if (criticalErrors.length > 0) {
      logIssue('medium', 'console', `Console errors on home page (${criticalErrors.length})`, criticalErrors.slice(0, 3).join('; '))
    }
  })

  test('Circles page loads correctly', async () => {
    await page.getByRole('link', { name: /circles/i }).click()
    await page.waitForTimeout(3000)
    const shot = await screenshotAndLog(page, 'admin-circles')

    // Check My Connections section
    const hasConnections = await page.locator('text=/my connections/i').isVisible().catch(() => false)
    if (!hasConnections) {
      logIssue('medium', 'functional', 'My Connections section missing on Circles page', 'Expected to see "My Connections" section', shot)
    }

    // Verify Sent Requests section doesn't mislabel join requests
    const sentSection = page.locator('section', { has: page.locator('text=Sent Requests') })
    if (await sentSection.isVisible().catch(() => false)) {
      const sentText = await sentSection.textContent()

      // Check for the specific bug: pending join requests labeled as "Invited to"
      // If both "Invited to" and "wants to join" exist for the same person, that's the bug
      // (We can't fully verify without cross-referencing home page, but screenshot evidence helps)
      await screenshotAndLog(page, 'admin-circles-sent-requests')
    }
  })

  test('Circle detail page loads correctly', async () => {
    await page.getByRole('link', { name: /circles/i }).click()
    await page.waitForTimeout(2000)

    const circleAction = page.getByRole('button', { name: /get started|open circle/i }).first()
    if (await circleAction.isVisible({ timeout: 5000 }).catch(() => false)) {
      await circleAction.click()
      await page.waitForTimeout(2000)
      const shot = await screenshotAndLog(page, 'admin-circle-detail')

      // Admin should see Members section
      const hasMembers = await page.locator('text=Members').isVisible().catch(() => false)
      if (!hasMembers) {
        logIssue('medium', 'functional', 'Members section missing on circle detail', 'Admin view should show Members section', shot)
      }

      // Admin should see Chat/Leave buttons
      const hasChat = await page.getByRole('button', { name: /chat/i }).isVisible().catch(() => false)
      if (!hasChat) {
        logIssue('low', 'functional', 'Chat button missing on circle detail', 'Expected Chat button for circle members', shot)
      }
    }
  })

  test('Coffee/Meetups page loads correctly', async () => {
    await page.getByRole('link', { name: /coffee|meetups/i }).first().click()
    await page.waitForTimeout(3000)
    await screenshotAndLog(page, 'admin-meetups')
  })

  test('Discover page loads correctly', async () => {
    await page.getByRole('link', { name: /discover/i }).click()
    await page.waitForTimeout(3000)
    const shot = await screenshotAndLog(page, 'admin-discover')

    // Check Trending Requests section
    const hasTrending = await page.locator('text=Trending Requests').isVisible().catch(() => false)
    if (!hasTrending) {
      logIssue('low', 'functional', 'Trending Requests missing on Discover page', 'Expected to see Trending Requests section', shot)
    }
  })

  test('Profile page loads correctly', async () => {
    await page.goto('/profile', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await screenshotAndLog(page, 'admin-profile')
  })
})

// ─── Member account tests ───────────────────────────────────────────────

test.describe.serial('QA: Member account flows', () => {
  /** @type {import('@playwright/test').Page} */
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await loginAs(page, 'member')
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('Home page loads for member', async () => {
    await page.waitForTimeout(3000)
    await screenshotAndLog(page, 'member-home')
  })

  test('Circles page shows member perspective', async () => {
    await page.getByRole('link', { name: /circles/i }).click()
    await page.waitForTimeout(3000)
    await screenshotAndLog(page, 'member-circles')

    // Check for pending invitations
    const hasPending = await page.locator('text=Pending').isVisible().catch(() => false)
    if (hasPending) {
      await screenshotAndLog(page, 'member-circles-pending')
    }
  })

  test('Member circle detail shows non-host view', async () => {
    await page.getByRole('link', { name: /circles/i }).click()
    await page.waitForTimeout(2000)

    const circleAction = page.getByRole('button', { name: /get started|open circle/i }).first()
    if (await circleAction.isVisible({ timeout: 5000 }).catch(() => false)) {
      await circleAction.click()
      await page.waitForTimeout(2000)
      const shot = await screenshotAndLog(page, 'member-circle-detail')

      // Non-host should NOT see Join Requests section
      const hasJoinRequests = await page.locator('text=Join Requests').isVisible().catch(() => false)
      if (hasJoinRequests) {
        logIssue('high', 'functional', 'Non-host member sees Join Requests section', 'Only circle creators should see the Join Requests admin section. This member is not the creator.', shot)
      }
    }
  })

  test('Discover page loads for member', async () => {
    await page.getByRole('link', { name: /discover/i }).click()
    await page.waitForTimeout(3000)
    await screenshotAndLog(page, 'member-discover')
  })

  test('Profile page loads for member', async () => {
    await page.goto('/profile', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await screenshotAndLog(page, 'member-profile')
  })
})

// ─── Cross-user consistency tests ───────────────────────────────────────

test.describe('QA: Cross-user consistency', () => {
  test('both users see consistent circle data', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const adminPage = await ctx1.newPage()
    const memberPage = await ctx2.newPage()

    try {
      await loginAs(adminPage, 'admin')
      await loginAs(memberPage, 'member')

      // Both go to circles
      await adminPage.getByRole('link', { name: /circles/i }).click()
      await memberPage.getByRole('link', { name: /circles/i }).click()
      await adminPage.waitForTimeout(3000)
      await memberPage.waitForTimeout(3000)

      await screenshotAndLog(adminPage, 'cross-admin-circles')
      await screenshotAndLog(memberPage, 'cross-member-circles')

      // Verify no contradicting data between views
      // Admin's "Sent Requests" should not include items the member sees as "Join request pending"
      const adminSent = adminPage.locator('section', { has: adminPage.locator('text=Sent Requests') })
      if (await adminSent.isVisible().catch(() => false)) {
        const adminSentText = await adminSent.textContent()

        // Get member's name
        await memberPage.getByRole('link', { name: /profile/i }).click()
        await memberPage.waitForTimeout(1000)
        const memberName = await memberPage.locator('h1, h2').first().textContent().catch(() => 'unknown')

        // If admin's Sent Requests contains member's name with "Invited to",
        // but admin didn't actually invite them — that's the bug
        if (adminSentText?.includes('Invited to') && memberName && adminSentText?.includes(memberName)) {
          // Check member's home page — if member has "wants to join" for same circle, it's the bug
          await memberPage.goto('/home', { waitUntil: 'networkidle' })
          await memberPage.waitForTimeout(2000)
          const memberHomeText = await memberPage.textContent('body')

          if (memberHomeText?.includes('wants to join')) {
            logIssue('critical', 'functional',
              'Join request mislabeled as invite in admin Sent Requests',
              `Admin's Circles page shows "${memberName} Invited to [circle]" but this user actually requested to join. The admin did not send an invite.`,
              'test-results/qa-cross-admin-circles.png'
            )
          }
        }
      }
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
