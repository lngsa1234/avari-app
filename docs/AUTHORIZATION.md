# Avari - Authorization Model

**Last Updated:** 2026-04-13

Ownership and access control for the three primary call/room contexts — 1:1 coffee chats, meetups (events), and circles (connection groups). This document is the authoritative reference for "who can do what" across the app.

For authentication (how we verify a user is logged in), see [AUTHENTICATION.md](./AUTHENTICATION.md). For the raw schema, see [DATABASE.md](./DATABASE.md).

---

## Table of Contents
1. [Overview](#overview)
2. [Enforcement Layers](#enforcement-layers)
3. [Coffee Chat (1:1)](#coffee-chat-11)
4. [Meetup / Event](#meetup--event)
5. [Circle (Connection Group)](#circle-connection-group)
6. [Cross-Cutting: LiveKit Token Authorization](#cross-cutting-livekit-token-authorization)
7. [Cross-Cutting: Transcript Access](#cross-cutting-transcript-access)
8. [Admin Role](#admin-role)
9. [Known Gaps](#known-gaps)
10. [Keeping This Document in Sync](#keeping-this-document-in-sync)

---

## Overview

Avari has three domains where a user joins a room with other users:

| Context | Primary table | Membership table | Room id format |
| --- | --- | --- | --- |
| 1:1 Coffee Chat | `coffee_chats` | (inline on row: requester_id, recipient_id) | `coffee-{coffee_chat_id}` |
| Meetup / Event | `meetups` | `meetup_signups` | `meetup-{meetup_id}` |
| Circle / Connection Group | `connection_groups` | `connection_group_members` | `connection-group-{meetup_id or group_id}` |

Each context has its own lifecycle, its own set of roles, and its own gating mechanism. This document lists every role and every action they are permitted to take, with a code reference for where the check lives.

---

## Enforcement Layers

Authorization is enforced in two layers. Each row in the tables below points to whichever layer is authoritative for that action.

### Layer 1: Row-Level Security (Postgres RLS)

- Enforced by the database regardless of which client calls it.
- Applies automatically when mutations come from the browser's authenticated Supabase client (`lib/supabase.js`).
- Definitions live in `migrations/*.sql`. One known exception: `coffee_chats` policies are documented in [DATABASE.md §coffee_chats](./DATABASE.md) but have no corresponding migration file — they were applied out-of-band.
- Service-role calls via `createAdminClient()` **bypass RLS** and rely on explicit checks in the route handler.

### Layer 2: API Route Checks

- Required for any route that uses `createAdminClient()`.
- Standard pattern: `authenticateRequest(request)` → explicit filter (`.eq('user_id', user.id)`) or membership lookup.
- Routes that do not use admin client should still call `authenticateRequest` to produce a 401 for unauthenticated traffic, and then rely on RLS for authorization.

### Rule of thumb

> If the helper function takes a `supabase` parameter from the browser, RLS is doing the work. If it uses `createAdminClient()`, the route must do the work.

Helper functions in `lib/*Helpers.js` that appear "ungated" (no explicit `user_id` filter) are safe **only when** all their callers pass a user-scoped Supabase client and RLS is configured on the target table. Any new API route that imports such a helper and passes an admin client creates an authorization hole.

---

## Coffee Chat (1:1)

**Schema:** `coffee_chats` (id, requester_id, recipient_id, status, scheduled_time, topic, notes, room_url, duration, completed_at)

**Status lifecycle:**

```
                      ┌─────────────┐
                      │   pending   │ (requester creates)
                      └──────┬──────┘
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
         ┌─────────┐   ┌──────────┐   ┌──────────┐
         │ accepted│   │ declined │   │cancelled │
         └────┬────┘   └──────────┘   └──────────┘
              │
              ↓
         ┌─────────┐
         │scheduled│
         └────┬────┘
              │
      ┌───────┴───────┐
      ↓               ↓
 ┌──────────┐   ┌──────────┐
 │completed │   │abandoned │ (24h past scheduled_time, no connect)
 └──────────┘   └──────────┘
```

Auto-decline runs 24h past `scheduled_time` for still-pending chats (`lib/coffeeChatHelpers.js:260-272`). Auto-abandon runs for accepted chats where the call never connected.

### Role × Action Matrix

| Role | Action | Gated by |
| --- | --- | --- |
| Requester | Create chat | `lib/coffeeChatHelpers.js:39` (authenticated user becomes `requester_id`); RLS insert policy requires `auth.uid() = requester_id` |
| Requester | Cancel | RLS update policy allows either party to update any column (documented in [DATABASE.md:527-548](./DATABASE.md)) |
| Requester | View / list own chats | `lib/coffeeChatHelpers.js:177` (`.or(requester_id.eq.X, recipient_id.eq.X)`) + RLS select policy |
| Requester | Join video call | `app/api/livekit-token/route.js` — `isRoomMember()` checks `requester_id === user.id` |
| Recipient | Accept | `lib/coffeeChatHelpers.js:71` (no helper-level check); enforced by RLS update policy (either party) |
| Recipient | Decline | `lib/coffeeChatHelpers.js:101` (no helper-level check); enforced by RLS update policy |
| Recipient | View pending requests | `lib/coffeeChatHelpers.js:238` (filtered by `recipient_id`) + RLS |
| Recipient | Join video call | `app/api/livekit-token/route.js` — `isRoomMember()` checks `recipient_id === user.id` |
| Either participant | View recap transcript | `app/api/get-recap-transcript/route.js` — checks `user.id ∈ call_recaps.participant_ids` |
| Non-participant | Anything | Blocked by `coffee_chats` RLS (`auth.uid() = requester_id OR auth.uid() = recipient_id`) |

### Notes

- **Recipient does not auto-accept.** A freshly-created coffee chat sits in `pending` until the recipient explicitly accepts or declines.
- **Transcript consent is separate from ownership.** The transcript ownership check verifies the caller was a participant — it does not verify mutual consent state. 1:1 transcripts require mutual consent per the product policy; that is enforced at recording time, not read time.

---

## Meetup / Event

**Schema:** `meetups` (id, topic, date, time, duration, created_by, circle_id?), `meetup_signups` (meetup_id, user_id), `meetup_proposals` (admin-proposed meetups before approval)

**Note:** Meetups linked to a circle have `circle_id` populated. The circle's `creator_id` also gets edit permission via `migrations/fix-meetups-update-rls.sql`.

### Role × Action Matrix

| Role | Action | Gated by |
| --- | --- | --- |
| Creator (host) | Create meetup | `lib/meetupProposalHelpers.js:163`; RLS insert via `migrations/fix-meetups-insert-rls.sql` |
| Creator | Edit / reschedule | RLS: `migrations/fix-meetups-update-rls.sql` (`created_by = auth.uid()` OR circle creator) |
| Creator | Delete | RLS (`created_by = auth.uid()`) |
| Creator | Join video call | `app/api/livekit-token/route.js` — `isRoomMember()` checks `meetups.created_by === user.id` |
| Signed-up participant | Sign up | Helper-level (no participant-limit enforcement in code) |
| Signed-up participant | Leave | Helper-level (client-side only) |
| Signed-up participant | Join video call | `app/api/livekit-token/route.js` — verifies row in `meetup_signups` for this user + meetup |
| Non-participant | Join video call | Denied by `livekit-token/route.js` |
| Non-participant | View meetup details | Ungated — meetup discovery is public within the authenticated app |
| Admin | Approve meetup proposal | `lib/meetupProposalHelpers.js:163` — no admin role check at helper level (see [Known Gaps](#known-gaps)) |
| Admin | Reject meetup proposal | `lib/meetupProposalHelpers.js:237` — same |

### Notes

- **Creator is not auto-added to `meetup_signups`.** This is why the LiveKit authorization has an explicit `created_by` branch — without it, a host could not join their own call.
- **No participant limit enforced.** If the product adds a seat cap, it must be enforced server-side (route or helper) — not relied upon to come from the client.

---

## Circle (Connection Group)

**Schema:** `connection_groups` (id, creator_id, name, is_active, vibe_category, description), `connection_group_members` (group_id, user_id, status, invited_at), `meetups.circle_id` (for circle-linked meetings)

**Member status values:** `invited`, `accepted`, `declined`, `pending` (join request awaiting creator approval)

### Circle Membership Lifecycle

```
            ┌─────────────────────────────────┐
            │     Non-member (discoverable)   │
            └──────────────┬──────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                                 │
     Creator invites                   Non-member
          │                        requests to join
          ↓                                 │
   ┌─────────────┐                          ↓
   │   invited   │                  ┌──────────────┐
   └──────┬──────┘                  │   pending    │
          │                         └───────┬──────┘
  ┌───────┴───────┐                         │
  ↓               ↓                  Creator approves
┌──────┐    ┌──────────┐                    │
│accept│    │ decline  │                    ↓
└──┬───┘    └──────────┘             ┌────────────┐
   ↓                                 │  accepted  │
┌────────────┐                       └─────┬──────┘
│  accepted  │                             │
└─────┬──────┘                      Leave / removed
      │                                    │
Leave / removed                             ↓
      │                             ┌─────────────┐
      ↓                             │   deleted   │
┌─────────────┐                     └─────────────┘
│   deleted   │
└─────────────┘
```

Creator is auto-inserted with `status='accepted'` (`lib/connectionGroupHelpers.js:120-126`). Creator cannot leave — only delete the entire circle.

### Discovery Model

Circles are **publicly discoverable within the authenticated app**, by design. There is no "private circle" visibility flag as of this writing.

- `migrations/database-migration-circle-discovery-policy.sql:4-8` — any authenticated user can SELECT any `connection_groups` row where `is_active = true`
- `migrations/database-migration-circle-discovery-policy.sql:14-25` — any authenticated user can SELECT `connection_group_members` rows where `status = 'accepted'` AND the parent circle is active (for member counts and social proof on the discover page)

This is what enables the "browse → request to join" flow: a non-member can see enough about a circle to decide whether to request membership. Implications:

- **Member identities leak to all authenticated users.** If user A is an accepted member of circle X, any other authenticated user can see A's membership via the discover page. This is acceptable for the current product model but should be revisited if a "private circles" feature is added.
- **No per-column redaction.** Any new column added to `connection_groups` is visible to all authenticated users once the circle is active. Consider this before adding sensitive fields (moderation notes, internal flags, etc.).

### Role × Action Matrix

| Role | Action | Gated by |
| --- | --- | --- |
| Creator | Create circle | `lib/connectionGroupHelpers.js:73` (`creator_id = auth.uid()`, 2-9 invitees); RLS `insert_groups` |
| Creator | Invite members | `lib/connectionGroupHelpers.js:104-108`; RLS `members_can_invite_or_request` |
| Creator | Approve join request | RLS: `update_memberships_as_creator` (`migrations/database-migration-circle-discovery-policy.sql:42-46`) |
| Creator | Reject join request | RLS: `delete_memberships_as_creator` (`migrations/database-migration-circle-discovery-policy.sql:50-53`) |
| Creator | Remove accepted member | RLS: `delete_memberships_as_creator` |
| Creator | Delete circle | `lib/connectionGroupHelpers.js:648-666` (explicit `creator_id` check) + RLS `delete_own_groups` |
| Creator | Create circle meetup | FK-linked via `circle_id`; edit permission inherited via circle-creator branch of meetups UPDATE policy |
| Creator | Leave | Not supported — creator must delete the circle |
| Creator | Auto-member | `lib/connectionGroupHelpers.js:120-126` (auto-inserted with `status='accepted'`) |
| Accepted member | View circle | RLS: `select_own_created_groups` / `select_member_or_invited_groups` / `select_active_groups_for_discovery` |
| Accepted member | View accepted member list | RLS: `select_memberships_for_discovery` |
| Accepted member | Join circle meetup call | `app/api/livekit-token/route.js` — verifies `status='accepted'` in `connection_group_members` |
| Accepted member | Post in group chat | Helper-level only; separate RLS on `circle_messages` |
| Accepted member | Invite new members | RLS: `members_can_invite_or_request` (`migrations/allow-circle-join-requests.sql:14-28`) |
| Accepted member | Leave | RLS: `delete_own_membership` (`migrations/allow-circle-join-requests.sql:34-37`) |
| Invited user (`status='invited'`) | View invited circle | RLS: `select_member_or_invited_groups` (visible even if circle is not yet active) |
| Invited user | Accept invite | `lib/connectionGroupHelpers.js:421` (no helper-level check); RLS `update_own_membership_status` enforces `user_id = auth.uid()` |
| Invited user | Decline invite | `lib/connectionGroupHelpers.js:447`; same RLS |
| Non-member | View active circle | Allowed — RLS `select_active_groups_for_discovery` (`is_active = true`) |
| Non-member | View accepted member list | Allowed — RLS `select_memberships_for_discovery` |
| Non-member | View inactive / hidden circle | Denied by RLS |
| Non-member | Request to join | RLS: `members_can_invite_or_request` (`user_id = auth.uid() AND status = 'pending'`) |
| Non-member | Withdraw join request | RLS: `delete_own_membership` |
| Non-member | Join call | Denied by `app/api/livekit-token/route.js` |
| Non-member | View circle messages | Denied by `circle_messages` RLS |
| Pending joiner (`status='pending'`) | View own pending request | RLS: `select_own_memberships` (`user_id = auth.uid()`) |

---

## Cross-Cutting: LiveKit Token Authorization

**Route:** `app/api/livekit-token/route.js`

Every LiveKit video call goes through this route to mint an access token. The route is the sole enforcement point for "is this user allowed into this room?" because LiveKit itself does not consult the Avari database — once a valid token is issued, LiveKit lets the bearer into the room with whatever grants the token carries.

**Guarantees:**

1. Every request is authenticated via `authenticateRequest()`. Unauthenticated traffic returns 401.
2. The token's `identity` field is set from the authenticated session (`user.id`), **never from the request body**. A client that sends `participantId: "some-other-user"` is silently overridden.
3. The room id is parsed by prefix (`coffee-`, `meetup-`, `connection-group-`), the corresponding UUID is validated, and the authenticated user is verified as a member of the underlying entity via `isRoomMember()`.
4. Unknown room id prefixes are rejected with 403.

**Room → membership mapping (defined in `isRoomMember`):**

| Room prefix | Entity | Membership check |
| --- | --- | --- |
| `coffee-{uuid}` | `coffee_chats.id` | `requester_id === user.id OR recipient_id === user.id` |
| `meetup-{uuid}` | `meetups.id` | `created_by === user.id OR` row in `meetup_signups` for (meetup_id, user_id) |
| `connection-group-{uuid}` | `meetups.id` → `circle_id`, or direct `connection_groups.id` | Row in `connection_group_members` with matching group_id, user_id, and `status='accepted'` |

Any new call context (e.g. a future "event" type) must extend `isRoomMember` with its own prefix branch. Do not allow an unchecked prefix through.

---

## Cross-Cutting: Transcript Access

**Route:** `app/api/get-recap-transcript/route.js`

Transcripts are stored in Supabase Storage (bucket: `call-transcripts`) and referenced by `call_recaps.transcript_path`. The route:

1. Requires authentication (`authenticateRequest`).
2. Validates the path prefix (must start with `recaps/`, no `..`).
3. Looks up the `call_recaps` row by `transcript_path`.
4. Verifies `user.id ∈ call_recaps.participant_ids` — the caller must have been a participant in the call that produced the transcript.

The participant check is a floor, not a ceiling. Product policy requires:

- **1:1 coffee chats:** mutual consent for transcript recording
- **Group meetups / circles:** host-controlled with notification to participants

Consent state is enforced at recording time (`app/api/save-call-recap/route.js` and the consent audit log), not at read time. The route's ownership check only prevents cross-account transcript access — it does not re-verify that consent was granted.

---

## Admin Role

**Mechanism:** `profiles.role = 'admin'`

**Helper:** `public.is_admin()` (SQL function defined in `migrations/fix-supabase-security-warnings.sql`)

**Usage:**
- `migrations/add-admin-manage-requests.sql` gates delete/update on `meetup_requests`
- `migrations/create-admin-analytics-rpc.sql` gates the admin analytics RPC
- `app/api/seed-data/route.js` uses a hardcoded admin email allowlist in addition

The admin role is **not currently enforced on meetup proposal approval** — see [Known Gaps](#known-gaps) below.

---

## Known Gaps

Documented here so they are visible rather than discovered later. None are believed to be currently exploitable given the existing call paths, but all should be closed before relying on them.

### 1. Coffee chat RLS policies are not in the repo

The UPDATE policy documented in [DATABASE.md:527-548](./DATABASE.md) is known to be applied in the live database but has no corresponding file in `migrations/`. A clean rebuild of the Supabase instance would not recreate it.

**Fix:** Add `migrations/add-coffee-chats-rls.sql` that codifies the current policies.

### 2. Coffee chat UPDATE policy lacks `WITH CHECK` and lets requester self-accept

The current policy is `USING (auth.uid() = requester_id OR auth.uid() = recipient_id)` with no `WITH CHECK` clause. Two consequences:

- The requester can update `status` to `accepted` on their own outbound request, bypassing the intended "recipient must approve" semantic.
- Either party can mutate fields other than status (scheduled_time, topic, notes) on a chat they participate in.

**Fix:** Tighten the UPDATE policy with a `WITH CHECK` clause, or gate accept/decline behind an API route that enforces "only recipient can transition pending → accepted/declined."

### 3. Meetup proposal approval has no admin role check

`lib/meetupProposalHelpers.js:163` (`approveProposal`) and `:237` (`rejectProposal`) do not check `profiles.role = 'admin'`. Whether this is currently exploitable depends on whether the admin UI is the only caller and whether that UI route performs its own admin gate.

**Fix:** Add an `is_admin()` check to the helper, or to the server route that wraps it.

### 4. No meetup participant limit enforcement

Meetups can grow beyond any intended seat cap. Not a security issue; listed here because it's adjacent to authorization and will eventually matter.

### 5. Transcript consent not re-verified at read time

The transcript route checks participant ownership only. Product policy requires consent, which is enforced only at write time. A consenting participant can always read a transcript they helped produce — as intended — but there is no after-the-fact revocation path.

**Fix (future):** If consent revocation is added, the route must check consent state in addition to participant membership.

### 6. Circles have no private / invite-only visibility

The discovery policy makes all active circles visible to all authenticated users. If the product adds "private circles," it requires a new `visibility` column and revised SELECT policy. See [Discovery Model](#discovery-model) above.

---

## Keeping This Document in Sync

This document is the authoritative human-readable source for the authorization model. When the underlying code or policies change, update this document in the same commit.

**Triggers for updating this document:**

1. Any change to `lib/apiAuth.js` (authentication or admin client behavior)
2. Any change to `app/api/livekit-token/route.js` or `app/api/get-recap-transcript/route.js`
3. Any new or modified RLS policy in `migrations/*.sql`
4. Any new call context or room type
5. Any change to the admin role mechanism
6. Any change to membership status values (`connection_group_members.status`, `coffee_chats.status`, etc.)

**Audit trail:** Update the `Last Updated` date at the top of this file. For material changes, add a row to `docs/DECISIONS.md` (if present) describing what changed and why.

**How to verify a row:** Every row in the role × action matrices cites a file:line reference. If you cannot verify the reference, the row is stale and should be re-checked before relying on it.
