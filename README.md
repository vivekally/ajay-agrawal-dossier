# Ajay Agrawal: A Dossier

A researched profile of **Ajay K. Agrawal**, Geoffrey Taber Chair in Entrepreneurship
and Innovation at the Rotman School of Management, University of Toronto, founder of the
Creative Destruction Lab, and co-author of *Prediction Machines* and *Power and Prediction*.

**Live:** https://vivekally.github.io/ajay-agrawal-dossier/

> Identity note: this is Ajay K. **Agrawal** of Rotman and CDL. Not Ajay Agarwal of Bain
> Capital Ventures, and not Ajay K. Agrawal the mechanical engineering combustion researcher.

## What's here

Eight tabs, each deep-linkable by hash (`#pm`, `#pp-between`, and so on):

| Tab | Contents |
|---|---|
| 01 Profile | Who he is, biographical facts, honours, public compensation record |
| 02 Career | Academic and commercial timelines, advisory roles, teaching, conferences |
| 03 Prediction Machines | The 2018 book, with four interactive infographics |
| 04 Power & Prediction | The 2022 sequel, with five interactive infographics |
| 05 Research | Interactive research arc, most-cited work, complete book list |
| 06 CDL & Ventures | Creative Destruction Lab at scale, ventures, board seats |
| 07 Reception | The positive record, and the Kotlikoff critique in full |
| 08 Sources | Every source, clickable, with method and known limits |

## Interactive infographics

**Prediction Machines**
- *The price change engine* - drag the cost of prediction and watch substitutes fall and complements rise
- *Anatomy of a decision* - clickable seven-component diagram
- *The AI Canvas* - the real worksheet, worked through four use cases
- *The Amazon dial* - turn up prediction accuracy until the business model flips

**Power and Prediction**
- *Point, application, system* - run the independence test on each level
- *The Between Times* - **real data**: US factory electrification (1899-1929) overlaid on US firm AI adoption (2023-2026) on a shared elapsed-time axis
- *Rules are glue* - the same AI dropped into a glued vs. an oiled system
- *The Great Decoupling* - four-stage walk through the Flint water crisis, 80% to 15% and back
- *AI Systems Discovery Canvas* - three steps, worked on home insurance

**Elsewhere:** salary history, research arc by theme over 25 years, CDL equity value over time.

## Second research pass

After the site first went live it was re-examined for gaps. That pass changed more than the
first one did:

- **h-index, previously "not found."** Google Scholar blocks bots, but Semantic Scholar
  (h=37, 79 papers) and OpenAlex (h=35, i10=58, 118 works) do not. Every title in both records
  was checked by hand against the name-collision problem; a third OpenAlex record (h=25) turned
  out to be contaminated with liposome pharmacology and is unusable.
- **Nine works published since 2022 that the dossier omitted**, including
  [*Do we want less automation?*](https://www.science.org/doi/10.1126/science.adh9429) in
  **Science** (2023) and
  [*Generative AI Is Still Just a Prediction Machine*](https://hbr.org/2024/11/generative-ai-is-still-just-a-prediction-machine)
  (HBR, 2024).
- **A whole research strand was missing**: the COVID-19 workplace-testing studies in *Science
  Advances* and *JAMA*. The second book's "oiled system" set piece is his own field research,
  not a borrowed anecdote.
- **Full salary history 2004 to 2025** (was 2014 to 2020 plus one undated figure). The undated
  $492,964.94 is **2024**. 2025 is $537,683, ranking 109th of 404,915 on the Ontario list.
- **Genpact director pay, previously "not found"**, read straight from the DEF 14A filings:
  FY2023 $287,483 and FY2025 $297,484.
- **Two claims on this site were corrected**, not just extended. It had said *Power and
  Prediction* answers none of Kotlikoff's objections and had left the generative-AI objection
  hanging as an open inference. The authors answered both in print, in *Science* and in HBR.
  Those answers are now cited and the original claims marked as superseded.
- **One attribution trap avoided**: *O-Ring Automation* (NBER w34639, 2026) sits alongside this
  work and is Gans and Goldfarb only, not Agrawal.

## Research provenance

Built from two research dossiers, both preserved verbatim in [`research/`](research/).
Seven items were resolved, confirmed, or corrected against primary sources during the build:

1. *Power and Prediction* ISBN: **9781647824198** (dossier had it as not found)
2. *Health Care Challenges* confirmed: UChicago Press, 14 Mar 2024, adds Catherine Tucker as editor
3. *The Economics of Transformative AI* **corrected**: co-edited with Brynjolfsson and Korinek, not Gans and Goldfarb
4. *Bayesian Entrepreneurship* confirmed: MIT Press, 14 Apr 2026, six editors
5. CDL scale **updated**: CAD $64B / 670+ companies / 17 locations / 24 streams (was $56B / 630+ / 13)
6. New paper added: *Genius on Demand*, NBER WP 34316, Oct 2025
7. Two real adoption data series sourced for the Between Times chart (Devine 1983; US Census BTOS)
8. Three dead links in the source dossier fixed or removed (Wikipedia CDL article is gone; Sanctuary bio 404; HBR article cited with the wrong month)

Claims carry confidence chips throughout: `VERIFIED`, `DISPUTED`, `UNVERIFIED`, `UPDATED`.
Where sources genuinely conflict, such as his MBA institution, both readings are shown and
neither is adjudicated.

## Dark mode

Three states in the masthead control: **Auto** (follows `prefers-color-scheme`, the default),
**Light**, **Dark**. An explicit choice persists in `localStorage` and is applied by an inline
script before first paint, so a dark viewer never sees a light flash.

The charts are the non-trivial part. SVG presentation attributes cannot take `var()`, so
`app.js` reads the palette out of the stylesheet with `readColors()` and each of the ten charts
registers a redraw in `REDRAW`. Switching theme re-reads the palette and rebuilds every chart
while preserving each widget's current selection. **If you add a chart, register its redraw.**

Both themes clear WCAG AA (4.5:1) on every text pair, verified against all three background
tokens. Fixing the dark palette surfaced two light-theme colours that had been failing AA
(`--ink-faint`, `--flag`); both were corrected.

## Build

No build step, no dependencies. Three files: `index.html`, `style.css`, `app.js`.
All charts are hand-rolled inline SVG. Design system in [DESIGN.md](DESIGN.md).

## Disclaimer

Independent research page. Not affiliated with, endorsed by, or reviewed by Ajay Agrawal,
the Rotman School of Management, the University of Toronto, or the Creative Destruction Lab.
