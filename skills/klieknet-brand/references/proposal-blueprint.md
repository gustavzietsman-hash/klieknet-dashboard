# KliekNet Proposal & Costing Blueprint

How Gustav likes proposals built. A proposal is a **single self-contained HTML
file** (embedded `<style>`, base64 logo, no external deps except the Google Fonts
link) so a client can open it directly. It uses the brand tokens **plus** `DM Mono`
for all figures, rates, and codes.

## Document setup

```html
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Solutions Proposal — {Client Name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
<!-- favicon from SKILL.md §2 -->
<style> /* brand-tokens.css, then proposal components below */ </style>
</head>
```

Add to `:root` for proposals: `--mono:'DM Mono',monospace; --green-dark:#5C7020;`

## The narrative spine (fixed order)

1. **Nav** — same shrinking lockup as the site (black circle + KLIEKNET wordmark).
2. **Dark hero** — black background, faint green grid lines + a soft radial green
   glow, a blinking-dot eyebrow, a big H1 (one word in green), a one-line sub, and
   a **meta row** (Prepared for · Date · Valid until · Prepared by) separated by a
   hairline.
3. **About / Contact** — two columns: short KliekNet intro + capability pills on
   the left; a bordered **contact card** (black header strip, labelled rows) right.
4. **The Challenge** — a 3-up bordered grid of problem cards (`challenge-card`):
   small uppercase number, tight H3, one-paragraph pain point. Names the client's
   real friction.
5. **Solution Phases** — the core. Stacked `phase-block`s: a 200px label column
   (phase tag pill + huge faint `phase-number`) beside content (H3, lead, a 2-up
   `capability-grid`, a green-dotted `feature-list`, mono `tech-tags`). Tag the
   first phase core/green, later/optional phases with the muted "optional" tag.
6. **Workflow** — a 5-column bordered strip of steps (icon tile → H4 → one line),
   hover tints green.
7. **Integrations** — 2-up cards naming the actual tools to connect, each with an
   icon, a type label, a sentence, and a green "ready/connected" status dot.
8. **Standards** — 3-up cards with a mono code (e.g. CIDB / POPIA / ISO ref), H4,
   one line. Signals rigour.
9. **Investment** — pricing cards (see below).
10. **CTA** — centred: eyebrow, H2, lead, buttons (book a call + WhatsApp).
11. **Footer** — dark, KLIEK**NET** logo (green NET), a fine-print note.

Optional: an interactive **demo/preview** block (tabbed "app shell") when showing
a working tool — see `groeneveld-civils-ai-proposal-costing.html` for the pattern.

## Pricing cards (the "Investment" section)

Black cards for the core offer; a **white card with a dashed border** for optional
add-ons. Figures are large, weight 800, in `--green` (or `--green-dark` on the
white/optional card).

```html
<div class="pcard">
  <div class="phead">
    <div class="ptag">Phase 1 · Core build</div>
    <div class="ptitle">AI Business Hub</div>
    <div class="psub">Email + calendar + comms, unified</div>
    <div class="pprice"><span class="amt">R 18 500</span><span class="un">once-off</span></div>
  </div>
  <ul class="pbody">
    <li>Discovery & tool mapping</li>
    <li>Integration of up to 6 tools</li>
    <li>2-week delivery</li>
  </ul>
</div>

<div class="pcard optional">  <!-- white + dashed border -->
  <div class="phead">
    <div class="ptag">Optional</div>
    <div class="ptitle">Monthly care plan</div>
    <div class="pprice"><span class="amt">R 2 400</span><span class="un">/ month</span></div>
  </div>
  <ul class="pbody"><li>Monitoring, tweaks & support</li></ul>
</div>
```

```css
.pcard{background:var(--black);border-radius:12px;overflow:hidden;color:#fff}
.pcard.optional{background:#fff;border:1px dashed var(--muted2);color:var(--black)}
.phead{padding:1.6rem 1.6rem 1.2rem;border-bottom:1px solid rgba(255,255,255,.08)}
.pcard.optional .phead{border-bottom:1px solid var(--border)}
.ptag{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.35rem}
.pcard.optional .ptag{color:var(--green-dark)}
.ptitle{font-size:18px;font-weight:700}
.psub{font-size:13px;color:rgba(255,255,255,.45);margin-top:.2rem}
.pcard.optional .psub{color:var(--muted)}
.pprice{display:flex;align-items:flex-end;gap:8px;margin-top:.9rem}
.pprice .amt{font-family:var(--mono);font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--green)}
.pcard.optional .pprice .amt{color:var(--green-dark)}
.pprice .un{font-size:13px;color:rgba(255,255,255,.35);padding-bottom:3px}
.pcard.optional .pprice .un{color:var(--muted)}
.pbody{list-style:none;padding:1.2rem 1.6rem 1.6rem}
.pbody li{font-size:13px;line-height:1.9;color:rgba(255,255,255,.7)}
.pcard.optional .pbody li{color:var(--muted)}
```

Currency is South African Rand: `R 18 500` (space as thousands separator). All
figures in `DM Mono`. End the section with a small note on what's included/excluded
and validity.

## Costing / line-item table

When the proposal includes a detailed costing, use a bordered table: header row in
`--bg`, mono for quantities/rates/totals, right-aligned numerics, a bold total row,
and `--green-dark` for the headline total. Always footnote sample figures as
illustrative. For an AI-assisted, interactive costing workspace (line builder +
chat + CSV export), follow the `cost-calc-layout` pattern in
`groeneveld-civils-ai-proposal-costing.html`.

## Phase-block & feature-list CSS (core pieces)

```css
.phase-block{border-top:1px solid var(--border);padding:3rem 0;display:grid;grid-template-columns:200px 1fr;gap:3rem}
.phase-block:last-child{border-bottom:1px solid var(--border)}
.phase-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:.75rem;background:var(--black);color:#fff}
.phase-tag-green{background:var(--green-bg);color:var(--green-dark);border:1px solid var(--green-border)}
.phase-tag-opt{background:var(--bg);color:var(--muted);border:1px solid var(--border)}
.phase-number{font-size:52px;font-weight:800;color:var(--border);letter-spacing:-.04em;line-height:1}
.feature-list{list-style:none;display:flex;flex-direction:column;gap:9px}
.feature-list li{display:flex;align-items:flex-start;gap:9px;font-size:14px;color:var(--muted);line-height:1.65}
.feature-dot{flex-shrink:0;width:17px;height:17px;border-radius:50%;background:var(--green-bg);border:1px solid var(--green-border);display:flex;align-items:center;justify-content:center;margin-top:2px}
.feature-dot::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--green)}
.tech-tag{background:var(--bg);color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:2px 9px;font-size:11px;font-family:var(--mono)}
```

Reference files to copy from when in doubt:
`stelkor-proposal-klieknet.html` (clean proposal + pricing cards) and
`groeneveld-civils-ai-proposal-costing.html` (proposal + interactive costing demo).
