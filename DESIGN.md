# Design System -- CircleW

## Product Context
- **What this is:** Women's professional networking community with hybrid meetups, 1:1 coffee chats, group video calls, and messaging
- **Who it's for:** Professional women building meaningful career connections
- **Space/industry:** Professional networking, community platforms (peers: Geneva/Bumble BFF, Lunchclub, Elpha)
- **Project type:** Web app (Next.js), mobile-responsive

## Aesthetic Direction
- **Direction:** Organic/Natural
- **Decoration level:** Intentional (subtle warmth through background tints and gentle shadows)
- **Mood:** A warm living room, not a corporate lobby. Professional women feel comfortable being real here. Earthy, grounded, grown-up. Trust is built at the pixel level.
- **What we are NOT:** Cold corporate blue, splashy startup neon, or generic SaaS card grid. CircleW should feel curated, editorial, and warm.

### Creative Risks (deliberate departures from category norms)
1. **Serif display headings (Lora)** ... 95% of community apps are all-sans-serif. Serifs signal trust, maturity, editorial quality. Makes CircleW feel curated.
2. **Brown/cream palette** ... no one else in the networking space uses warm browns. Distinctive without being loud. Requires careful contrast management.
3. **Restrained color** ... no gradient buttons, no colored badges, no decorative elements. Typography hierarchy and whitespace do the work. Feels premium and trustworthy.

## Typography
- **Display/Hero:** Lora (serif) ... editorial warmth, trust signal, biggest visual differentiator from competitors
- **Body:** DM Sans ... clean, modern, excellent readability at all sizes
- **UI/Labels:** DM Sans (same as body)
- **Data/Tables:** DM Sans with `font-variant-numeric: tabular-nums` for aligned numbers
- **Code:** JetBrains Mono (if needed for developer-facing features)
- **Loading:** Google Fonts via `<link>` tag with `display=swap`

### Type Scale
| Level | Font | Weight | Size | Line Height | Usage |
|-------|------|--------|------|-------------|-------|
| Hero | Lora | 600 | 36px | 1.2 | Landing page headline |
| Page Title | Lora | 600 | 24px | 1.3 | Page headings (People, Circles, Profile) |
| Section | Lora | 600 | 18px | 1.4 | Section headings (Suggested for You) |
| Card Title | Lora | 600 | 16px | 1.4 | Circle names, card headings |
| Body | DM Sans | 400 | 15px | 1.6 | Bios, descriptions, content |
| UI | DM Sans | 500 | 14px | 1.5 | Buttons, labels, @usernames |
| Caption | DM Sans | 400 | 13px | 1.5 | Meta info, timestamps, secondary text |
| Micro | DM Sans | 600 | 11px | 1.3 | Uppercase labels, section markers |

## Color

### Approach
Restrained. One warm brown primary + cream neutrals. Color is rare and meaningful. People's faces and their words provide the visual richness.

### Palette
All colors defined in `lib/designTokens.js`. This is the single source of truth.

| Token | Hex | Usage |
|-------|-----|-------|
| `colors.primary` | #8B6F5C | Primary brand, focus rings, links |
| `colors.primaryDark` | #6B5344 | Hover states on primary elements |
| `colors.primaryLight` | #A89080 | Disabled states, subtle indicators |
| `colors.bg` | #FDF8F3 | Page background |
| `colors.bgAlt` | #FAF6F1 | Alternate background sections |
| `colors.bgCard` | #F5EDE4 | Card backgrounds, modals |
| `colors.white` | #FFFFFF | Elevated card backgrounds |
| `colors.text` | #3D2B1F | Primary text (10.1:1 contrast on bg) |
| `colors.textSecondary` | #584233 | Secondary text, body copy |
| `colors.textLight` | #7A6855 | Tertiary text, @usernames |
| `colors.textMuted` | #A89080 | Placeholder text, disabled labels |
| `colors.buttonBg` | #5C4033 | Primary buttons |
| `colors.buttonHover` | #4A3228 | Button hover |
| `colors.buttonText` | #FAF5EF | Button text (warm white, not pure white) |
| `colors.success` | #4CAF50 | Success states, online indicators |
| `colors.error` | #C0392B | Error states, destructive actions |
| `colors.warning` | #C4784A | Warning states |
| `colors.sage` | #8B9E7E | Accent (avatar backgrounds, data viz) |
| `colors.gold` | #C9A96E | Accent (achievement, premium indicators) |
| `colors.tagBg` | #EFE6DB | Tag/chip background |
| `colors.tagText` | #6B4F3A | Tag/chip text |

### Dark Mode Strategy
Reduce saturation 10-20%, shift surfaces to warm dark browns:
- Page bg: #1A1410
- Card bg: #2A2118
- Text: #F0E8E0 (warm off-white, not pure white)
- Primary buttons invert: light text on dark uses the lighter primary
- Preserve the warm undertone. Never go blue-gray.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (community apps need breathing room, not data density)

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | 4px | Tight gaps (inline elements, icon padding) |
| `spacing.sm` | 8px | Small gaps (between tags, button icon gap) |
| `spacing.md` | 12px | Medium gaps (form field spacing, card internal) |
| `spacing.lg` | 16px | Standard gaps (between cards, section internal) |
| `spacing.xl` | 20px | Large gaps (page margins on mobile) |
| `spacing.2xl` | 24px | Section spacing |
| `spacing.3xl` | 32px | Major section breaks |
| `spacing.4xl` | 48px | Page-level vertical rhythm |
| `spacing.5xl` | 64px | Hero spacing, major landmark gaps |

## Layout
- **Approach:** Grid-disciplined (consistent columns, predictable alignment)
- **Max content width:** 960px (enough for 2-3 column layouts without feeling wide)
- **Grid:** CSS Grid with `minmax()` for responsive card layouts

| Breakpoint | Width | Columns | Usage |
|------------|-------|---------|-------|
| Mobile | <640px | 1 | Single column, full-width cards |
| Tablet | 640-860px | 2 | Two-column grids, sidebar collapses |
| Desktop | 860-1024px | 2-3 | Main content + sidebar |
| Wide | >1440px | 3-4 | Full grid, generous whitespace |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `radii.sm` | 6px | Small elements (tags, badges, toggle buttons) |
| `radii.md` | 10px | Cards, inputs, buttons |
| `radii.lg` | 14px | Modals, large cards |
| `radii.xl` | 20px | Bottom sheets, major containers |
| `radii.full` | 9999px | Avatars, pills, circular buttons |

## Motion
- **Approach:** Intentional (subtle entrance animations, meaningful state transitions)
- **Easing:**
  - Enter: `ease-out` (elements arriving feel decisive)
  - Exit: `ease-in` (elements leaving feel quick)
  - Move: `ease-in-out` (repositioning feels smooth)
- **Duration:**
  - Micro: 50-100ms (button press, toggle state)
  - Short: 150-250ms (fade in/out, card hover, grid/list transition)
  - Medium: 250-400ms (modal open, bottom sheet slide, page transition)
  - Long: 400-700ms (skeleton shimmer, loading animation)
- **Reduced motion:** Respect `prefers-reduced-motion`. Replace animations with instant state changes. Never use motion as the only feedback mechanism.
- **What to animate:** Card hover lifts, modal overlays, bottom sheet slides, toast entrances, grid/list layout switches, skeleton shimmer. That's it. No decorative motion.

## Component Patterns

### Avatars
- Sizes: 32px (inline), 44px (list), 48px (card), 56px (grid card), 80px (profile)
- Fallback: First initial in Lora serif, on a colored background from the accent palette (sage, gold, blue, primary)
- Always `border-radius: radii.full`
- Online indicator: 8px green dot, bottom-right with 2px white border

### Cards
- Background: `colors.white` with `1px solid colors.border`
- Hover: background shifts to `colors.bgWarm`
- Border radius: `radii.md` (10px)
- Padding: 16px internal
- No decorative shadows at rest. Subtle shadow on hover only: `0 2px 8px colors.shadow`

### Buttons
- Primary: `colors.buttonBg` bg, `colors.buttonText` text, `radii.md` corners
- Secondary: `colors.bgCard` bg, `colors.text` text, `1px colors.border` border
- Ghost: transparent bg, `colors.primary` text
- Minimum height: 44px (touch target)
- Font: DM Sans 14px 500

### Empty States
- Never "No items found." Always:
  1. Warm illustration or icon (subtle, not loud)
  2. Lora heading explaining the state
  3. DM Sans body text with context
  4. Primary CTA button with clear next action
- Background: `colors.white` with `1px dashed colors.borderMedium`

### Toasts/Notifications
- Position: bottom-center on mobile, bottom-right on desktop
- Background: `colors.white` with `colors.shadowMd` shadow
- Auto-dismiss: 2-3 seconds for success, persist for errors
- Always include an icon (checkmark for success, X for error)

## Accessibility
- **Color contrast:** All text/bg combinations meet WCAG AA minimum. Primary text on bg = 10.1:1 ratio.
- **Touch targets:** Minimum 44x44px for all interactive elements
- **Focus visible:** 2px solid `colors.primary`, 2px offset (already in globals.css)
- **Keyboard navigation:** Tab order follows visual order. Modals trap focus. Escape closes overlays.
- **Screen readers:** Meaningful alt text, ARIA labels on interactive elements, announce state changes
- **Reduced motion:** Honor `prefers-reduced-motion` media query

## Anti-Patterns (what CircleW must never do)
1. Purple/violet gradients (AI slop signal)
2. 3-column feature grid with icons in colored circles
3. Centered everything with uniform spacing
4. Gradient buttons
5. Generic stock-photo hero sections
6. Emoji as design elements in headings
7. Colored left-border on cards
8. "Welcome to CircleW" / "Unlock the power of..." marketing copy
9. Cookie-cutter section rhythm
10. Decorative blobs, floating circles, wavy SVG dividers

## Implementation Reference
- **Token file:** `lib/designTokens.js` (import from `@/lib/designTokens`)
- **Global CSS:** `app/globals.css` (Tailwind + custom utilities)
- **HTML references:** `app/UX reference/` (10 HTML mockups for people, circles, cards, feed)
- **Preview page:** Generated by /design-consultation (see `/tmp/` for latest)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-04 | Initial design system created | Documented existing tokens + competitive research via /design-consultation |
| 2026-04-04 | Keep Lora serif for headings | Biggest visual differentiator from competitors (95% use all-sans-serif) |
| 2026-04-04 | Keep warm brown palette | Distinctive in networking space, signals warmth and trust |
| 2026-04-04 | Restrained color approach | Let content (people's faces) be the color, not UI chrome |
| 2026-04-04 | Intentional motion (not minimal) | Community apps need warmth, but not at the cost of distraction |
| 2026-04-04 | Dark mode: warm dark browns | Never blue-gray. Preserve the organic warmth in dark contexts |
