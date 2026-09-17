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
| `--ink-faint` | `#8A8A94` | captions, meta |
| `--rule` | `#E2DED4` | hairlines, borders |
| `--accent` | `#1F5F7A` | site accent, links, Profile tab (deep teal) |
| `--pm` | `#1F5F7A` | Prediction Machines book accent (deep teal) |
| `--pp` | `#A8451F` | Power & Prediction book accent (ember) |
| `--flag` | `#8A6D1F` | disputed / unverified claim chips (muted brass) |
| `--ok` | `#3F6B45` | verified / confirmed chips |

Never use pure `#FFFFFF` or pure `#000000`.

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
