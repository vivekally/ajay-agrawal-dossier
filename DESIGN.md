# DESIGN.md: Ajay Agrawal Dossier

This site uses its own design system. It deliberately does NOT use the parent
Arrive Finance DESIGN.md palette (forest green / amber urgency), which is built
for a consumer finance product and carries semantics that do not apply here.
Typography follows the house pairing so this site sits alongside the others.

## Typography
- Headings: **Fraunces** (serif, variable optical size). Never Inter, never Plus Jakarta for headings.
- Body: **Plus Jakarta Sans**, 400/500/600.
- Numbers, figures, citation counts, dollar amounts, chart labels: **JetBrains Mono** with `font-variant-numeric: tabular-nums`.
- Body copy 17px / 1.65. Measure capped at 68ch.

## Color
Archival paper base, deep ink text, one accent per book so the two book tabs
are visually distinguishable at a glance.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F7F5F0` | page background, warm off-white |
| `--paper-raised` | `#FFFDF8` | cards |
| `--ink` | `#17171A` | primary text |
| `--ink-soft` | `#55555F` | secondary text |
| `--ink-faint` | `#6A6A75` | captions, meta (AA at small sizes on all three grounds) |
| `--rule` | `#E2DED4` | hairlines, borders |
| `--accent` | `#1F5F7A` | site accent, links, Profile tab (deep teal) |
| `--pm` | `#1F5F7A` | Prediction Machines book accent (deep teal) |
| `--pp` | `#A8451F` | Power & Prediction book accent (ember) |
| `--flag` | `#7F631B` | disputed / unverified claim chips (muted brass) |
| `--ok` | `#3F6B45` | verified / confirmed chips |

Never use pure `#FFFFFF` or pure `#000000`.

## Dark mode
Three states. An explicit choice stamps `data-theme="light"`/`"dark"` on `<html>` and persists
in `localStorage` under `aa-theme`; the default "Auto" stamps nothing and follows
`prefers-color-scheme`. An inline script in `<head>` applies the stored choice before first
paint so a dark viewer never sees a light flash.

The full light palette is defined on bare `:root`. The dark palette is defined **twice**: once
inside `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and
once under `:root[data-theme="dark"]`, so an explicit choice wins in both directions. Never
give a colour its only definition inside a media query or a `[data-theme]` block.

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#F7F5F0` | `#121319` |
| `--paper-raised` | `#FFFDF8` | `#1A1C24` |
| `--paper-sunk` | `#F0EDE5` | `#0E0F14` |
| `--ink` | `#17171A` | `#EDEBE4` |
| `--ink-soft` | `#55555F` | `#A9A7A0` |
| `--ink-faint` | `#6A6A75` | `#8E8D97` |
| `--rule` | `#E2DED4` | `#292B34` |
| `--rule-strong` | `#CFC9BC` | `#3D4049` |
| `--accent` / `--pm` | `#1F5F7A` | `#5FA8C7` |
| `--pp` | `#A8451F` | `#E0825A` |
| `--flag` | `#7F631B` | `#CBA84B` |
| `--ok` | `#3F6B45` | `#74AC7D` |
| `--on-accent` | `#FFFDF8` | `#0E0F14` |

Every text pair must clear WCAG AA (4.5:1) at the size it is used. Verified in both themes.

**Charts do not inherit the theme for free.** SVG presentation attributes cannot take `var()`,
so `app.js` reads the palette from the stylesheet via `readColors()` and every chart that bakes
a colour into markup registers a redraw in `REDRAW`. Changing the theme calls `redrawAll()`,
which re-reads the palette and rebuilds all ten charts while preserving each widget's current
selection. **If you add a chart, register its redraw, or it will keep the old palette.**

## Confidence chips
Every non-obvious factual claim carries a chip. Load-bearing UI, not decoration.
- `VERIFIED`: confirmed against a primary or publisher source during this build.
- `DISPUTED`: sources genuinely conflict (e.g. the MBA institution).
- `UNVERIFIED`: appears in the source dossier, not independently confirmed.
- `UPDATED`: the source dossier's figure was superseded by newer data.

## Layout & motion
- 8px spacing scale. Cards `border-radius: 4px`, 1px `--rule` border, no drop shadows beyond a 1px lift.
- Tabs are real URL hashes so every tab is deep-linkable and shareable.
- No global `scroll-behavior: smooth` (it strands deep links). Scroll is instant.
- Transitions max 180ms, ease-out. Charts animate once on first reveal only.

## Writing rules
- **No em dashes anywhere.** Recast the sentence, or use a comma, colon, semicolon, or parentheses.
- Every external reference is a real clickable link, opening in a new tab.
- Numbers are always attributed inline to the source that produced them.
