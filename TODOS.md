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
