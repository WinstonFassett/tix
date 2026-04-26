---
name: tix
description: Local-first issue tracker for developers and AI agents. Linear for one.
colors:
  void: "oklch(0.145 0 0)"
  chalk: "oklch(0.985 0 0)"
  lift: "oklch(0.269 0 0)"
  dim: "oklch(0.708 0 0)"
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.205 0 0)"
  dust: "oklch(0.97 0 0)"
  hairline: "oklch(0.922 0 0)"
  slate: "oklch(0.556 0 0)"
  signal-red: "oklch(0.577 0.245 27.325)"
  signal-red-deep: "oklch(0.396 0.141 25.723)"
  signal-red-fg: "oklch(0.637 0.237 25.331)"
  live-amber: "oklch(0.85 0.12 85)"
  live-amber-dark: "oklch(0.35 0.08 85)"
  status-open: "#f97316"
  status-in-progress: "#facc15"
  status-review: "#22d3ee"
  status-on-hold: "#94a3b8"
  status-done: "#8b5cf6"
  status-closed: "#94a3b8"
  type-task: "#94a3b8"
  type-bug: "#ef4444"
  type-feature: "#3b82f6"
  type-epic: "#d946ef"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, 'Courier New', monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.void}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.dim}"
    textColor: "{colors.void}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-destructive:
    backgroundColor: "{colors.signal-red-deep}"
    textColor: "{colors.signal-red-fg}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  input-default:
    backgroundColor: "{colors.void}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-status:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.dim}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
---

# Design System: tix

## 1. Overview

**Creative North Star: "The Informed Workbench"**

tix is a tool for people who think in tickets. Its surfaces are dark by default, not because dark is fashionable, but because this tool lives beside terminal windows under dim office light, at the edge of a working session. The UI makes itself small. The ticket title, the status icon, the agent diff: these are what deserve attention. The chrome recedes.

The system is monochromatic by conviction. Every surface is a shade of the same cold gray spectrum. The only chromatic color is signal-red, reserved for the one state that demands immediate action. When a brand accent arrives later, it will land with contrast precisely because the ground is this quiet. The silence is structural.

Progressive disclosure is the governing architecture: a list row shows what's needed to scan, a click surfaces what's needed to act, the detail panel opens what's needed to decide. Nothing else appears. Density without clutter is not an accident here — it's the result of constant subtraction.

**Key Characteristics:**
- Dark-primary, monochromatic, zero chroma except signal-red and live-amber flash
- System sans-serif: weight and scale carry all hierarchy; color is secondary
- Flat surfaces with tonal layering — depth via lightness delta, not shadow
- Keyboard-first with instant visual feedback (150–250ms, expo-out easing)
- Progressive disclosure: rows scan, panels act, nothing decorates

## 2. Colors: The Zero Palette

One axis. One signal. The palette is a single lightness spectrum from void to chalk, with signal-red as the only chromatic note.

Note on light mode: the app ships with both dark and light mode. The tokens below are canonical for the dark-primary experience. Light-mode counterparts (canvas, dust, hairline, slate, ink) are listed in Neutral and documented here for completeness.

### Primary
- **Chalk** (`oklch(0.985 0 0)`): Primary text on dark surfaces. Near-white, zero chroma. Ticket titles, active labels, primary button text in dark mode.
- **Void** (`oklch(0.145 0 0)`): The main application background in dark mode. Dark without being black. Everything lives on this surface.

### Neutral
- **Lift** (`oklch(0.269 0 0)`): Elevated surfaces in dark mode. Cards, popovers, sidebar hover states, dropdown backgrounds. The one step above Void.
- **Dim** (`oklch(0.708 0 0)`): De-emphasized text in dark mode. Metadata, timestamps, ticket IDs, placeholder text.
- **Canvas** (`oklch(1 0 0)`): Light-mode background. Future revisions should tint toward a brand hue (chroma 0.005–0.01) once a brand color is established.
- **Ink** (`oklch(0.205 0 0)`): Primary interactive element color in light mode (buttons, focused controls).
- **Dust** (`oklch(0.97 0 0)`): Muted surface in light mode. Equivalent role to Lift.
- **Hairline** (`oklch(0.922 0 0)`): Borders and input backgrounds in light mode.
- **Slate** (`oklch(0.556 0 0)`): De-emphasized text in light mode. Equivalent role to Dim.

### Signal
- **Signal Red / Light** (`oklch(0.577 0.245 27.325)`): Destructive action color in light mode. Error text and icons. Never decorative.
- **Signal Red / Deep** (`oklch(0.396 0.141 25.723)`): Destructive background in dark mode.
- **Signal Red / FG** (`oklch(0.637 0.237 25.331)`): Destructive foreground text in dark mode.
- **Live Amber / Light** (`oklch(0.85 0.12 85)`): Row background flash on WebSocket update, light mode. Fades to transparent over 2s.
- **Live Amber / Dark** (`oklch(0.35 0.08 85)`): Same flash, dark mode. The only warm tone in the dark palette.

### Semantic (Status, Type, Priority)
These are the only fully chromatic colors in the system. They live in `src/lib/types.ts` as hex constants, separate from the CSS custom property system. They carry meaning — not decoration.

**Status colors** (used for status icons and kanban column headers at 10% opacity):
- **Open** (`#f97316`, orange): Active but unstarted. Warm, attention-seeking.
- **In Progress** (`#facc15`, yellow): Active work. High visibility.
- **Review** (`#22d3ee`, cyan): Waiting on review. Cool, transitional.
- **On Hold** (`#94a3b8`, slate): Paused. Desaturated — not urgent.
- **Done** (`#8b5cf6`, violet): Completed. Distinct from active statuses.
- **Closed** (`#94a3b8`, slate): Same as On Hold — both inactive states share a color.

**Type colors** (used for type icons):
- **Task** (`#94a3b8`, slate): Default. No elevated priority.
- **Bug** (`#ef4444`, red): Distinct from signal-red — this red is type identification, not destructive action.
- **Feature** (`#3b82f6`, blue): New capability. Standard blue.
- **Epic** (`#d946ef`, fuchsia): Highest-level container. The most saturated color in the system.

**Priority:** Uses `currentColor` with opacity modulation. No dedicated color per level — density of fill bars communicates priority. Urgent uses an exclamation icon; no priority uses 50%-opacity dashes.

### Named Rules
**The One Signal Rule.** Signal-red is the only chromatic color permitted in the neutral surface range. It appears on destructive actions and error states only. Its rarity is the point. Nothing competes for chromatic attention.

**The Colorize-Ready Rule.** The neutral palette is intentionally chroma-free. When a brand accent is introduced via `$impeccable colorize`, it will arrive into a system calibrated to receive it. Do not add speculative accent colors before that pass.

## 3. Typography

**UI Font:** System sans: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace`

**Character:** Single-family system sans throughout, differentiated by weight and scale. No ornament, no custom web font load. Mono is a second register used specifically for machine-generated identifiers (ticket IDs, keyboard hints) — distinguishable at a glance from human-written content.

### Hierarchy
- **Display** (600, 1.125rem / 18px, lh 1.3): Panel headings, dialog titles, ticket title in the detail view.
- **Title** (500, 0.9375rem / 15px, lh 1.4): Ticket titles in list and kanban rows. Section headings in sidebar panels.
- **Body** (400, 0.875rem / 14px, lh 1.5): Ticket descriptions, markdown body in the editor, prose content. Max line length 65ch.
- **Label** (600, 0.75rem / 12px, lh 1.3, ls 0.05em, uppercase): Command palette group headings, column headers, field labels. All-caps and tracked — distinct from content, never mistaken for a title.
- **Mono** (400, 0.8125rem / 13px, lh 1.5): Ticket IDs, keyboard shortcut hints, inline code. Machine-reads at 13px; human-readable context happens around it.

### Named Rules
**The Weight-First Rule.** Color is absent; weight creates hierarchy. 600 on 400 is the contrast that makes a list scannable. Never use the same weight at adjacent hierarchy levels.

**The Mono-for-Machine Rule.** Monospace signals machine-generated or machine-readable content. Ticket IDs are mono. Human titles are not. This boundary is maintained without exception — no mono for labels, headings, or prose.

## 4. Elevation

The system is flat by default. Depth is communicated through tonal difference between surfaces, not shadow. A lifted surface (oklch(0.269 0 0)) on void background (oklch(0.145 0 0)) reads as elevated through lightness delta alone. Box shadows do not appear at rest.

The three-step tonal stair: Void (background) → Lift (cards, popovers, hover states) → elevated surface (dropdowns above cards). This stair is the entire elevation vocabulary in dark mode. Light mode uses Canvas → Dust equivalently.

Motion-driven overlays (dialog, command palette) use semi-transparent void with backdrop-blur. This is the designated glassmorphism exception. It is purposeful: the overlay relationship to the content beneath is part of the communication. Do not apply glass treatment elsewhere.

### Named Rules
**The Tonal-Depth Rule.** Elevation is communicated by lightness delta, not box-shadow. If you need to show something is above something else, use a lighter background surface. A shadow layered on top of this tonal stair is redundant.

**The Flat-at-Rest Rule.** Surfaces are flat at rest. State-responsive shadows (drag operations, focused floating panels) are permitted in narrow cases but must be diffuse and brief, never structural.

## 5. Components

### Buttons
Precise, restrained. A button is a control, not a call to action. No decoration, no inflated padding.

- **Shape:** Subtly rounded — 0.5rem (8px)
- **Primary (dark):** Chalk text on near-black background. Padding 6px 12px. No border.
- **Ghost:** Transparent at rest. Lift background appears on hover at 150ms ease-out. Used for sidebar actions, toolbar controls, and secondary options.
- **Destructive:** Signal Red background with Signal Red / FG text. Appears only in confirmation dialogs. Never inline.
- **Hover:** Background-only transition, 150ms ease-out. No translate, no scale, no lift.
- **Focus:** 2px ring at 2px offset, ring-token color (oklch(0.439 0 0) dark / oklch(0.708 0 0) light).

### Badges / Status Chips
The read-only metadata vocabulary: status, type, priority, tag.

- **Shape:** 0.375rem (6px) radius. Small but readable.
- **Style:** Lift background, Dim text. No border. Label-size type (0.75rem).
- **Interaction:** Chips are indicators, not buttons. Clicking triggers a dropdown from a containing target — the chip face itself is never the interactive region.
- **Priority:** Compact numeric or icon indicator. Never a colored stripe.

### Ticket Row (Signature Component)
The atomic unit of the application. Every design decision serves the scannability of this component.

- **Layout:** Single horizontal flex row. Status icon | Mono ID | Title (title weight, flex-grow) | type | priority | assignee | tags | relative date. Fields compress via container queries on the tag cell.
- **Hover:** Full-row Lift background tint, 150ms ease-out.
- **Live update flash:** `tix-row-highlight` keyframe: Live Amber → transparent over 2s ease-out. Applied on WebSocket change events.
- **Entry animation:** `tix-row-enter` — 250ms ease-out, opacity 0→1 + translateY(4px→0). CSS-only to avoid Framer Motion layout animation conflict.
- **Selection / active state:** Lift background at full opacity, chalk text at full opacity. Muted fields de-emphasize further.

### Command Palette (Signature Component)
The primary navigation surface. Global trigger is `/`.

- **Shape:** 0.625rem rounded. Centered floating overlay.
- **Backdrop:** Semi-transparent Void + backdrop-blur. The designated glassmorphism exception.
- **Entry:** `tix-palette-in` keyframe — 180ms `cubic-bezier(0.16, 1, 0.3, 1)`, translateY(-12px) + scale(0.98) → rest.
- **Group headings:** Label style — 0.75rem, 600 weight, uppercase, 0.05em tracking, Dim color.
- **Items:** Title weight, full-width, Lift hover background at 100ms.
- **Input:** Search field at top, full width, no border treatment — the palette surface IS the input context.

### Inputs / Fields
- **Style:** Seam/hairline-colored border (1px), matching background, 0.5rem radius.
- **Focus:** Ring at 2px, ring-token color. Border shifts to primary (Chalk/Ink).
- **Placeholder:** Dim (dark) / Slate (light).
- **Error state:** Signal Red border and error label. No background fill on the field.
- **Disabled:** 50% opacity. No visual affordance for interaction.

### Sidebar Navigation
- **Surface:** Void background (same as page). No separate panel background — the sidebar IS part of the page canvas.
- **Items:** Ghost button treatment — transparent at rest, Lift on hover.
- **Active:** Lift background at full opacity, Chalk text, no left-border stripe. Active state is area-fill, not a colored edge.
- **Counts:** Mono type, Dim color. Secondary metadata, never prominent.

## 6. Do's and Don'ts

### Do:
- **Do** use tonal layering (Void → Lift) to communicate surface elevation. It is the complete elevation system.
- **Do** use weight contrast (400 → 500 → 600) as the primary hierarchy signal across adjacent levels.
- **Do** use monospace type for ticket IDs and machine-readable values, consistently and without exception.
- **Do** reserve signal-red for destructive actions and error states. Nothing else.
- **Do** animate with `opacity` and `transform` only. Use `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) at 150–250ms.
- **Do** make interactive targets full-row or full-area. Never target just the text inside a row.
- **Do** apply progressive disclosure: a row shows what's needed to scan, not everything that exists.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on rows, cards, or nav items. Replace with full-border, background tint, or nothing.
- **Don't** introduce chromatic colors in the neutral range. The palette is mono until `$impeccable colorize` formally adds an accent. No speculative tints.
- **Don't** apply glassmorphism outside the command palette and dialog overlays. Everywhere else: flat solid surfaces.
- **Don't** use gradient text (`background-clip: text`). Weight and size carry emphasis — color does not.
- **Don't** use box-shadow at rest on any surface. Tonal depth only.
- **Don't** animate layout properties (width, height, padding, margin). Opacity and transform only.
- **Don't** use the same font weight at adjacent hierarchy levels. The Weight-First Rule requires a minimum one-step contrast.
- **Don't** build SaaS dashboard patterns: hero metric blocks, gradient accent bars, identical card grids. This is a workbench.
- **Don't** soften the aesthetic toward Notion-style whitespace or Jira-style badge proliferation. Density is intentional; every element earns its presence.
