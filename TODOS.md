# TODOS

## Migrate authenticated views to Next.js routing
**Priority:** High | **Added:** 2026-03-30 | **Source:** /plan-eng-review (outside voice)

Convert `currentView` state routing in MainApp.js to actual Next.js App Router pages (`/app/home/page.js`, `/app/circles/[id]/page.js`, etc.). Currently the entire authenticated app is one component with `setCurrentView` called 40 times. No browser back button, no shareable URLs, no route-based code splitting.

This is the root architectural issue. Solving it unlocks: browser history, shareable deep links, automatic code splitting, and natural component boundaries.

**Plan as next major project after current refactoring pass.**

---

## Complete SWR migration for remaining pages
**Priority:** Medium | **Added:** 2026-03-30 | **Source:** /plan-eng-review

Migrate CoffeeChatDetailView, CircleDetailView, and MainApp to use `useSupabaseQuery` instead of manual useState/fetch. After useHomeData is migrated, these 3 are the remaining holdouts. Inconsistent data fetching patterns make the codebase harder to reason about.

5 components already use SWR (AllCirclesView, AllPeopleView, AllEventsView, NetworkDiscoverView, MeetupsView). Pattern is proven.

**Depends on:** useHomeData SWR migration (should go first as the template).

---

## Split remaining 3 mega-components
**Priority:** Medium | **Added:** 2026-03-30 | **Source:** /plan-eng-review

Apply the 1393cf7 pattern (extract data hooks + child components) to:
- CircleDetailView (2,497 lines)
- CoffeeChatDetailView (2,193 lines)
- NetworkDiscoverView (1,961 lines)

After ConnectionGroupsView and MeetupsView are split, the pattern will be well-established.

**Depends on:** ConnectionGroupsView + MeetupsView splits should complete first.

---

## Complete design token migration
**Priority:** Low | **Added:** 2026-03-30 | **Source:** /plan-eng-review

~300 hardcoded hex values remain across 25 files after ConnectionGroupsView and MeetupsView are migrated. Design audit found color drift (#8B6F5C vs #8B6F5E vs #8B6F5A across files). One source of truth in `lib/designTokens.js` prevents brand inconsistency.

12 components already migrated (ff7bb03, d247d99).

**Depends on:** Token migration during top-2 component splits.

---

## Build invite/share link system
**Priority:** P1 | **Added:** 2026-03-31 | **Source:** /plan-ceo-review (launch readiness)

Each user gets a personalized invite link ("Join [Name]'s circle on CircleW") that converts better than the generic landing page. Needs: unique link generation, referral tracking (who invited whom), landing page variant that shows inviter's name/photo, and auto-connect inviter+invitee on signup.

Community products grow through word of mouth. This is the primary growth lever post-launch.

**Effort:** S with CC (~1-2 hours)
**Depends on:** Launch + first user feedback.

---

## Auto-match coffee chats for new users
**Priority:** P1 | **Added:** 2026-03-31 | **Source:** /plan-ceo-review (launch readiness)

Within 24h of signup, automatically match new users with a compatible existing member for a coffee chat. Uses existing AI matching (`/api/generate-connection-recommendations`) + existing coffee chat scheduling flow. Needs: scheduling logic (find mutual availability from `coffee_chat_slots`), notification to both parties, edge case handling when no compatible match exists (fallback to admin-matched).

Solves the "signed up, never came back" retention problem. Key post-launch lever once there are 10+ users to match from.

**Effort:** M with CC (~3-4 hours)
**Depends on:** Launch + minimum ~10 active users.

---

## Add consent audit log for legal compliance
**Priority:** Medium | **Added:** 2026-04-03 | **Source:** /plan-eng-review (outside voice)

Add a permanent `consent_audit_log` table that records who consented to transcription, when, and for which call. Current `call_consent` table is ephemeral (rows deleted on call end), which means there's no proof of consent after the call.

GDPR and US two-party consent laws (13 states) may require evidence that consent was obtained. This becomes important if CircleW operates in EU or California. The audit log should be append-only, never deleted (except by privacy deletion request), and include: channel_name, requester_id, responder_id, status, consented_at timestamp.

**Effort:** S with CC (~1 hour)
**Depends on:** Transcript consent system v1 shipping first.
