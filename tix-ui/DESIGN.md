# DESIGN.md — tix-ui

Linear-inspired issue tracker dashboard. Ultra-minimal, monochrome, information-dense. Dark mode is the primary experience; light mode is equally supported.

## 1. Visual Theme & Atmosphere

- **Density:** High — compact rows, tight spacing, no decorative chrome
- **Personality:** Tool-like, precise, quiet. Feels like a dev tool, not a SaaS marketing page
- **Color strategy:** Monochrome surfaces + semantic accent colors only for status/type/priority
- **Motion:** Subtle — overlays fade+scale in (150-180ms, `cubic-bezier(0.16, 1, 0.3, 1)`). No bounces, no springs
- **Inspiration:** Linear, GitHub Issues, Raycast

## 2. Color Palette

### Surface tokens (OKLch)

| Token               | Light                   | Dark                    | Role                        |
|----------------------|-------------------------|-------------------------|-----------------------------|
| `--background`       | `oklch(1 0 0)`          | `oklch(0.145 0 0)`     | Page background             |
| `--foreground`       | `oklch(0.145 0 0)`      | `oklch(0.985 0 0)`     | Primary text                |
| `--card`             | `oklch(1 0 0)`          | `oklch(0.145 0 0)`     | Card/panel background       |
| `--primary`          | `oklch(0.205 0 0)`      | `oklch(0.985 0 0)`     | Buttons, strong emphasis    |
| `--secondary`        | `oklch(0.97 0 0)`       | `oklch(0.269 0 0)`     | Secondary surfaces          |
| `--muted`            | `oklch(0.97 0 0)`       | `oklch(0.269 0 0)`     | Disabled, subtle fills      |
| `--muted-foreground` | `oklch(0.556 0 0)`      | `oklch(0.708 0 0)`     | Secondary text, placeholders|
| `--accent`           | `oklch(0.97 0 0)`       | `oklch(0.269 0 0)`     | Hover states, highlights    |
| `--border`           | `oklch(0.922 0 0)`      | `oklch(0.269 0 0)`     | All borders                 |
| `--ring`             | `oklch(0.708 0 0)`      | `oklch(0.439 0 0)`     | Focus rings                 |
| `--destructive`      | `oklch(0.577 0.245 27.325)` | `oklch(0.396 0.141 25.723)` | Delete, error actions |

> **Note:** Each surface token has a matching `*-foreground` variant (e.g. `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`). These mirror `--foreground` / `--primary` values and are omitted for brevity. The full set is in `src/styles.css`.

### Semantic accent colors (hex, used in icons & badges)

| Color     | Hex       | Usage                           |
|-----------|-----------|---------------------------------|
| Orange    | `#f97316` | Status: Open                    |
| Yellow    | `#facc15` | Status: In Progress             |
| Cyan      | `#22d3ee` | Status: In Review               |
| Slate     | `#94a3b8` | Status: On Hold / Closed, Type: Task |
| Violet    | `#8b5cf6` | Status: Done                    |
| Red       | `#ef4444` | Type: Bug                       |
| Blue      | `#3b82f6` | Type: Feature                   |
| Fuchsia   | `#d946ef` | Type: Epic                      |

These colors are applied directly via SVG `fill`/`stroke` on status, priority, and type icons — they do not use theme tokens.

## 3. Typography

| Element              | Classes / Values                                     |
|----------------------|------------------------------------------------------|
| Font family          | `font-sans` (system stack), `antialiased`            |
| Page title (ticket)  | `text-2xl font-bold`                                 |
| Section headings     | `text-[11px] uppercase tracking-wider text-muted-foreground font-semibold` |
| Body / table rows    | `text-sm` (14px)                                     |
| Badges               | `text-xs` (12px) or `text-[10px]`                    |
| Command palette item | `text-sm`                                            |
| Ticket ID            | `font-mono text-xs text-muted-foreground`            |

No custom fonts. System sans-serif everywhere. Monospace only for IDs and code.

## 4. Component Patterns

### Buttons
- Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`
- Sizes: `default` (h-9 px-4), `sm` (h-8 px-3 text-xs), `lg` (h-10 px-6), `icon` (size-9)
- Hover: `bg-primary/90` (default), `bg-secondary/80` (secondary), `bg-accent` (ghost)
- Focus: `focus-visible:ring-1 focus-visible:ring-ring`
- Border radius: `rounded-md` (--radius - 2px = ~8px)

### Cards
- `bg-card border rounded-lg shadow-sm`
- No internal padding — handled by children
- Card foreground inherits from `--card-foreground`

### Inputs
- `h-9 border border-input bg-transparent rounded-md px-3 text-sm shadow-sm`
- Focus: `focus-visible:ring-1 focus-visible:ring-ring`
- Placeholder: `text-muted-foreground`

### Badges
- `rounded-md border px-2.5 py-0.5 text-xs font-semibold`
- Variants: default (filled), secondary (muted), outline (border only), destructive

### Popovers & dropdowns
- `bg-popover text-popover-foreground border rounded-lg shadow-md`
- Open animation: fade + scale from 96%
- Max height scroll with `overflow-y-auto`

### Command palette
- Centered overlay, `shadow-2xl rounded-xl border bg-popover`
- Entry animation: `tix-palette-in` (translate Y -12px + scale 0.98 → identity, 180ms)
- Group headings: `text-xs uppercase tracking-wider font-semibold text-muted-foreground`
- Items: `text-sm`, active state `bg-accent text-accent-foreground`
- Shortcut key badges: `text-muted-foreground font-mono text-[10px]`

### Selectors (status, priority, type)
- Popover-based, two modes: compact (icon only) and full (icon + label)
- Selected item gets check icon
- Each option shows its semantic icon + label

### Select
- `h-9 border border-input bg-transparent rounded-md px-3 text-sm shadow-sm`
- Uses native `<select>` element with Tailwind styling

### Tags
- Kibo UI Tags component (Popover + Command composition)
- Chips: small badges with `×` remove button
- Input: inline search with free-form creation
- Autocomplete from existing tag pool

## 5. Layout

| Region          | Behavior                                              |
|-----------------|-------------------------------------------------------|
| Sidebar         | Left, resizable (drag edge), collapsible. Default 220px, clamp 180–480px |
| Main content    | Fills remaining width. Contains table/board + optional detail panel |
| Detail panel    | Right side, resizable (drag left edge), `Esc` to close. Default 520px, clamp 320–900px |
| Full ticket page| Replaces dashboard below 800px viewport width or explicit nav |

### Spacing scale
Standard Tailwind: `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `p-4` (16px), `p-6` (24px). No custom spacing tokens.

### Border radius
- Base: `--radius: 0.625rem` (10px)
- `radius-sm`: 6px, `radius-md`: 8px, `radius-lg`: 10px, `radius-xl`: 14px

## 6. Depth & Elevation

| Surface         | Shadow              | z-index | Use                    |
|-----------------|----------------------|---------|------------------------|
| Card            | `shadow-sm`          | auto    | Ticket cards in board   |
| Popover         | `shadow-md`          | 50      | Selectors, dropdowns    |
| Dialog          | `shadow-lg`          | 50      | Create ticket, confirms |
| Command palette | `shadow-2xl`         | 9999    | Global search/commands (always topmost) |
| Overlay backdrop| none (opacity only)  | 40      | `bg-black/50`          |

Elevation is minimal. Shadows are subtle — the monochrome palette relies on border contrast, not drop shadows.

## 7. Icons

- **Library:** Lucide React (`lucide-react`)
- **Custom SVG icons** for status, priority, and type — these encode semantic meaning through shape + color:
  - Status: circular progress ring (0%, 33%, 66%, 100%) with per-status fill color
  - Priority: bar chart (filled bars = severity). P0 uses alert/exclamation box
  - Type: distinct shapes per type
- Icon sizes: `w-4 h-4` (16px) default, `w-3.5 h-3.5` (14px) compact

## 8. Motion & Animation

| Animation        | Duration | Easing                           | Transform                |
|------------------|----------|----------------------------------|--------------------------|
| Overlay fade-in  | 150ms    | `ease-out`                       | opacity 0→1              |
| Dialog enter     | 180ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | scale 0.96→1, Y -4px→0  |
| Palette enter    | 180ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | Y -12px→0, scale 0.98→1 |

No exit animations. No layout transitions. Keep it snappy.

## 9. Keyboard Shortcuts

| Key              | Action                     |
|------------------|----------------------------|
| `C` / `c`        | Create new ticket          |
| `/`              | Open command palette       |
| `Cmd+K`          | Toggle command palette     |
| `Esc`            | Close modal/panel/palette  |
| `J` / `Alt+→`   | Next ticket (detail view)  |
| `K` / `Alt+←`   | Previous ticket            |

## 10. App Patterns

Composed views built from the primitives above. These are not exhaustively specified — read the component source for details.

| Component        | Primitives used                    | Notes                                   |
|------------------|------------------------------------|-----------------------------------------|
| **TicketTable**  | Table rows, StatusIcon, PriorityIcon, TypeIcon, Badge, inline Selectors | Primary view. Collapsible group headers with `color-mix()` tinting (semantic color at ~5-10% opacity over background) |
| **KanbanBoard**  | Card, StatusIcon, TicketCard       | Secondary view. Six status columns with tinted headers |
| **TicketCard**   | Card, Badge, StatusIcon, PriorityIcon | Compact card used in kanban columns     |
| **TicketDetailPanel** | Resizable right panel, TicketDetailBody | Drag left edge to resize. `Esc` to close |
| **Sidebar nav**  | Section headings, filter items with counts | Click item to filter dashboard. Sections: Status, Type, Tags |
| **Create dialog**| Dialog, Input, Selectors, Tags     | Full-screen modal with form fields      |
| **CommandPalette** | Command (cmdk), Dialog overlay   | Grouped sections: Actions, Ticket search, View switching |

### Group header tinting

Table and board group headers use CSS `color-mix()` to blend the group's semantic color with the background at low opacity. This gives each group subtle visual identity without introducing new colors.

## 11. Do's and Don'ts

### Always
- Use semantic tokens (`bg-background`, `text-foreground`, `border-border`) — never raw oklch values in components
- Use semantic accent colors from `types.ts` for status/priority/type — these are the only non-monochrome colors
- Match existing component patterns (shadcn/radix composition) before building anything custom
- Keep text `text-sm` or smaller. This is a dense tool, not a content site
- Prefer Popover + Command composition for any picker/selector UI

### Never
- Introduce new accent colors outside the defined status/type palette
- Use inline styles — all styling via Tailwind utilities
- Add heavy shadows or gradients — the design is flat + monochrome
- Use animated transitions longer than 200ms
- Mix font families — system sans-serif only (mono only for IDs/code)
- Add decorative elements, illustrations, or large whitespace blocks

## 12. Agent Quick Reference

```
Surface colors:     bg-background, bg-card, bg-secondary, bg-muted, bg-accent
Text colors:        text-foreground, text-muted-foreground, text-primary-foreground
Border:             border-border, border-input
Focus:              focus-visible:ring-1 focus-visible:ring-ring
Destructive:        text-destructive, bg-destructive

Status colors:      open=#f97316  in-progress=#facc15  review=#22d3ee
                    on-hold=#94a3b8  done=#8b5cf6  closed=#94a3b8

Type colors:        task=#94a3b8  bug=#ef4444  feature=#3b82f6  epic=#d946ef

Priority:           0=Urgent  1=High  2=Medium  3=Low  4=None

Radius:             rounded-sm(6px)  rounded-md(8px)  rounded-lg(10px)  rounded-xl(14px)
Shadows:            shadow-sm(cards)  shadow-md(popovers)  shadow-2xl(palette)
Animation easing:   cubic-bezier(0.16, 1, 0.3, 1) for all entrances
```
