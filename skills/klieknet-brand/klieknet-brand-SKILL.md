---
name: klieknet-brand
description: >-
  The complete KliekNet brand system — colours, logo, typography, dark mode, UI
  components, voice, and the standard proposal/costing layout. Use this skill
  WHENEVER the user references "K branding", "KliekNet branding", "my branding",
  "our brand", "the house style", or asks to build, redesign, refresh, or clean
  up anything KliekNet-facing: web pages, landing pages, proposals, quotes,
  costings, client demos, dashboards, decks, or emails. Trigger it even when the
  word "brand" isn't used but the deliverable is clearly a KliekNet artefact
  (e.g. "build me a proposal for client X", "make a page for the VoiceQuote
  feature", "design a costing sheet"). When in doubt and the work is for
  KliekNet or its clients, apply this skill.
---

# KliekNet Brand System

KliekNet is a South African (Stellenbosch) studio building AI-driven solutions —
workflow automation, business integration, and tools like VoiceQuote — for small
businesses, serving clients globally. Founder: Gustav Zietsman.

This skill is the single source of truth for how KliekNet looks, sounds, and lays
things out. Apply it so any artefact is indistinguishable from the live site.

## How to use this skill

1. **Always start from the tokens.** Drop in `references/brand-tokens.css` (the
   `:root` variables + base reset + dark-mode swap). Never hardcode hex values
   that a token already covers. This guarantees colour, type, and dark-mode
   consistency for free.
2. **Pick the artefact type** and read the matching reference:
   - Website / landing page / marketing UI → `references/components.md`
   - Proposal / quote / costing / client deliverable → `references/proposal-blueprint.md`
3. **Reuse, don't reinvent.** The component and proposal references contain
   ready markup. Compose from them; only invent new components when nothing fits,
   and when you do, build them from the tokens so they sit in the system.
4. **Ship a single self-contained `.html` file** for proposals and demos (embed
   the CSS in a `<style>` block + base64 the logo), since clients open them
   directly. For the main website, link the shared `klieknet.css` instead.

## 1. Colour

| Token | Hex | Use |
|---|---|---|
| `--black` | `#0A0A0A` | Primary text, dark sections, footer, logo circle, primary buttons |
| `--white` | `#FFFFFF` | Page background (light), cards |
| `--bg` | `#F4F5F7` | Soft grey section background, hover fills, chips |
| `--border` | `#E5E7EB` | All hairline borders / dividers |
| `--muted` | `#6B7280` | Body/secondary text |
| `--muted2` | `#9CA3AF` | Eyebrows, captions, placeholders, numerals |
| `--green` | `#a3c24d` | **Signature accent.** The "NET" in the wordmark, dots, icons, highlights, key figures |
| `--green-bg` | `#F4F9E8` | Tinted green surfaces (badges, success, feature dots) |
| `--green-border` | `#D4E8A0` | Borders on green surfaces |
| `--green-dark` | `#5C7020` | Green text on light/tinted backgrounds (legible green) |
| `--field` | `#E2E4E8` | Form field fills |

**Green discipline:** the green (`#a3c24d`, a soft lime/olive) is the brand's only
colour. Use it sparingly and with intent — an eyebrow, a dot, an icon stroke, the
key number, one CTA. Green on white text must use `--green-dark` for contrast;
`--green` itself is for fills, strokes, dark backgrounds, and large display figures.

## 2. Logo

- **Mark:** a solid black circle (`--black`) containing a white **K** (Inter/Arial
  Black, weight 900). Files in `assets/`: `kliek-logo-ai-fav.png` (round mark),
  `kliek-ai-logo.png` (full lockup: `KLIEK` in black + `NET` in green, with
  `AI-DRIVEN SOLUTIONS` tracked-out grey beneath).
- **Nav lockup:** circle mark + wordmark. `KLIEKNET` at 15px / weight 800 /
  letter-spacing .05em, with `AI-DRIVEN SOLUTIONS` sub at 9px / .14em / uppercase /
  `--muted2`. On scroll the circle shrinks 38→30px and the wordmark collapses away.
- **Favicon:** inline SVG, no external file needed:
  ```html
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%230A0A0A'/><text x='32' y='44' font-family='Arial Black' font-weight='900' font-size='32' fill='white' text-anchor='middle'>K</text></svg>">
  ```
- **Founder portrait:** `assets/gus-trans-new.png` (transparent engraving-style
  line portrait) for About/author blocks; `gus-sketch-new.png` is the sketch variant.

## 3. Typography

- **Family:** `Inter` (weights 300–900), `system-ui` fallback. Load weights
  300;400;500;600;700;800;900.
- **Mono:** `DM Mono` (400) — used **only** in proposals/costings for figures,
  rates, codes, and `.tech-tag`s. Gives technical credibility to numbers.
- **Scale & feel:** tight, confident display type.
  - Hero H1: `clamp(40px,5vw,70px)`, weight 800, line-height 1, letter-spacing −.03em
  - Section H2: `clamp(28px,3vw,42px)`, weight 800, letter-spacing −.025em
  - Eyebrow (`.s-eye`): 11px, weight 700, letter-spacing .14em, UPPERCASE, `--muted2` (or `--green`)
  - Body: 16px base, line-height 1.6–1.8; secondary copy in `--muted`
- Headlines may set one or two key words in `--green` via an `.ac` / `em` accent.

## 4. Geometry & spacing

- **Radii:** `--r: 8px` (buttons, small cards, fields-as-pills), `--rl: 12px`
  (large cards, panels), `16px` for big feature grids, `100px` for pills/chips,
  `50%` for the logo mark and avatars. Form inputs on the contact form are an
  intentional exception: **square (radius 0)** with 1.5px borders.
- **Section padding:** `6rem 5rem` desktop → `2.5rem` at ≤1100px → `1.25rem` at
  ≤768px. Nav is fixed, 64px tall.
- **Content width:** proposals centre on `max-width:1040px`; the site runs edge
  padding rather than a hard max.
- **Borders over shadows.** The system is built on 1px `--border` hairlines and
  grid lines, not drop shadows. Keep shadows minimal (only the mobile menu uses one).

## 5. Dark mode (required on every page)

Dark mode is a first-class feature, not an afterthought. Every page must support it.

- Put this **blocking script in `<head>`** (before paint, prevents flash):
  ```html
  <script>(function(){var s=localStorage.getItem('klieknet-theme');if(s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark');})();</script>
  ```
- Toggle button writes `localStorage['klieknet-theme']` = `dark`|`light` and
  toggles `.dark` on `<html>`. Moon/sun SVGs included in `components.md`.
- Dark palette: page `#111`, raised surfaces `#1A1A1A`, text `#F0F0F0`, borders
  `#2A2A2A`, muted `#9CA3AF`/`#6B7280`. The green stays `--green`; green-tinted
  chips become `#1C2800` bg / `#3A5010` border. Full mappings live in the tokens file.

## 6. Voice & tone

KliekNet sounds like a sharp, practical operator — not a corporate AI vendor.

- **Plain and benefit-led.** Lead with the client's pain and the outcome, not the
  tech. e.g. "Your team is scattered across 6+ apps. Leads slip through… so you can
  run your business instead of chasing it."
- **Concrete over abstract.** Real numbers, timeframes ("live within 2 weeks"),
  named tools (Gmail, Outlook, Teams, WhatsApp). Avoid buzzword soup.
- **Confident, short sentences.** Punchy. One idea per line in heroes.
- **Warm, local, human.** South African, founder-led ("a free 30-minute call"),
  never hypey. British/SA spelling (organise, optimise, colour, centre).
- **CTAs:** action + arrow — "Book a slot →", "Book a free discovery call →",
  "Reach out". Primary CTA is a black button; on dark sections it flips to a green
  button with black text.

## 7. Layout principles (UX/UI)

The house style is **clean, minimal, compartmentalised** — neat columns and rows,
generous whitespace, hairline separation.

- Compose pages as stacked full-width **sections**, alternating `--white` /
  `--bg` / `--black`, each opening with an eyebrow → H2 → lead paragraph.
- Prefer **grids and bordered tables of cards** (challenge grid, process grid,
  integration grid) over loose floating boxes. Equal columns, 1px gutters.
- One clear accent moment per section, not many.
- Every interactive element gets a calm transition (.15–.35s). Hover states are
  subtle (bg shifts to `--bg`/`--green-bg`, border darkens), never loud.
- Mobile: nav collapses to a hamburger at ≤1200px; multi-column grids fold to one
  column; padding tightens. Always verify the ≤768px view.

## 8. Proposals & costings

Proposals are standalone, self-contained HTML deliverables with their own embedded
CSS (copying these tokens) plus `DM Mono` for figures. They follow a fixed
narrative spine. **Read `references/proposal-blueprint.md`** for the full
section-by-section scaffold, the pricing-card system, and the costing-table
pattern before building one. The spine is:

`Dark hero (with meta row)` → `About / contact card` → `The Challenge (3 cards)` →
`Solution Phases (numbered)` → `Workflow (5 steps)` → `Integrations` →
`Standards` → `Investment (pricing cards)` → `CTA` → `dark footer`.

## 9. Quick checklist before shipping

- [ ] Tokens dropped in; no stray hardcoded greys/greens
- [ ] Favicon + Inter (+ DM Mono for proposals) loaded
- [ ] Logo lockup correct; "NET" green; sub-line tracked-out
- [ ] Dark-mode head script + toggle present and tested
- [ ] Eyebrow → H2 → lead rhythm on each section
- [ ] Green used sparingly; green-on-light uses `--green-dark`
- [ ] Responsive checked at 1200 / 1100 / 768px
- [ ] Voice: benefit-led, concrete, SA spelling, arrow CTAs

---

## Skill storage convention (read this when creating ANY new KliekNet skill)

All KliekNet skills live in the **`klieknet-dashboard`** repo under `skills/`,
one folder per skill, each with its own `SKILL.md`:

- **Repo:** `https://github.com/gustavzietsman-hash/klieknet-dashboard`
- **Path:** `skills/<skill-name>/` (this skill → `skills/klieknet-brand/`)
- **Register it:** add the new skill to the local launcher at
  `http://localhost:3000/skills.html` (served from the same repo) so it appears
  in the skills list.

When you (Claude) create or update a skill for Gustav, default to saving it to
`skills/<skill-name>/` in that repo and registering it in `skills.html` — don't
invent a new location. Commit with a clear message, e.g.
`feat(skills): add <skill-name> skill`. See `references/skill-storage.md` for the
exact commit/registration steps.
