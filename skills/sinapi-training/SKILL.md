---
name: sinapi-training
description: Continue the Sinapi Biomedical training platform (LEVO and other medical devices) — the WordPress + Elementor training site on klieknet-testing.co.za/sinapi, the proposal and quotes, and the optional Lovable app. Use for any Sinapi training site build, page change, Elementor/JetEngine set-up, proposal or quote update.
---

# Sinapi training platform — how to continue

Status (5 Oct 2026): **proposal sent, waiting to hear if Sinapi awards the work.** A proof page is live on the test site.

## 1. The job

Sinapi Biomedical (Stellenbosch, medical devices) wants a training site with videos for its devices, starting with the **LEVO chest drain**, later the full range (urinary drainage, obstetrics, specimen collection, nutrition), up to 5 languages, and an app later.

- Recommended design: **Concept B — training hub**. Pick a product, then a depth level: 30 sec · 5 min · Set-up · Train the trainer · Clinical · Resources.
- Brand (taken from sinapibiomedical.com): navy `#264B81`, blue `#4891CE`, ink `#18263D`, body text `#5B6880`; Poppins (headings) + Montserrat (body). Buttons and tabs **8px radius**, no uppercase buttons.
- Concept board (client link): https://dashboard.klieknet.com/api/client/10EB71C3/view

## 2. Build method (agreed with Gustav)

- **WordPress + Elementor Pro + Crocoblock JetEngine / JetSmartFilters**, Hello Elementor **child theme**.
- **No custom PHP theme, no Gutenberg.** Everything must stay editable in Elementor.
- Claude delivers **finished pages**: brand set once in Site Settings, desktop / tablet / phone all set, real images in the Media Library, imported and checked on the site by Claude — never loose JSON for Gustav to fix.
- Optional **Sinapi Training app** (Lovable) for reps and trainers: sign-in with Sinapi approval, groups, progress. Hosted on **Gustav's Hetzner via Coolify** (Supabase self-hosted). Reads content from the WordPress REST API, so content is edited once.

## 3. Test site

| What | Value |
|---|---|
| Site | https://klieknet-testing.co.za/sinapi/ (Xneelo) — admin `/sinapi/wp-admin` (Gustav logged in in Chrome) |
| Proof page | https://klieknet-testing.co.za/sinapi/levo/ — page ID **16**, Elementor Canvas |
| Theme | Hello Elementor + child "Sinapi Training (Hello Elementor Child)" (active) |
| Plugins | Elementor 4.3.x, Elementor Pro 4.3.0 (active, **licence not yet activated**). Not installed yet: JetEngine, JetSmartFilters, Bunny Stream, WPML |
| Elementor kit | post ID **6** |
| Menu | "Main menu" (slug `main-menu`, ID 2): Products, Library, Resources, Contact |
| Media | 9 logo navy · 10 logo white · 11 LEVO render · 12 ICU set-up thumb · 13 unit thumb · 14 mobilisation thumb |
| Videos | https://www.youtube.com/watch?v=S_iZ_Bl5E7Q · https://www.youtube.com/watch?v=p8rVQNogAxg |

Proof page contains: **sticky header** with Pro Nav Menu (hamburger at tablet and below), product aside, Nested Tabs depth selector with video + downloads + chapters + up next, coming-soon product cards, footer. Checked at 1366 / 820 / 500 px with no horizontal scroll.

## 4. How pages are built and pushed

1. Edit `scripts/build_page.py` (Python, no dependencies) and run it. It writes:
   - `levo-page-data.json` — Elementor page data
   - `kit-settings.json` — Site Settings (colours, fonts, buttons)
   - `sinapi-levo-product-page.json` — importable Elementor template
2. In Chrome on the WP admin, get a REST nonce: `fetch('/sinapi/wp-admin/admin-ajax.php?action=rest-nonce')`.
3. Push with WordPress REST (Elementor 4 registers these meta fields):
   - `POST /sinapi/wp-json/wp/v2/pages/16` → `meta._elementor_data` (JSON string), `_elementor_edit_mode: "builder"`, `_elementor_template_type: "wp-page"`
   - `POST /sinapi/wp-json/wp/v2/elementor_library/6` → `meta._elementor_page_settings` (kit)
4. Rebuild CSS: Elementor → Tools → **Clear Files & Data**, or open the page in Elementor and save.
5. Check the live page at desktop, tablet and phone; fix and repeat.

Control names must match Elementor's source (github.com/elementor/elementor): `includes/elements/container.php`, `includes/widgets/*`, `modules/nested-tabs`.

## 5. Elementor 4 gotchas (learned the hard way)

- Flex "Grow" sets shrink to 0 → use `_flex_size: "custom"`, `_flex_grow: 1`, `_flex_shrink: 1`.
- Container `width` does not cascade → set `width_tablet` and `width_mobile` explicitly.
- Row containers wrap on mobile by default → set `flex_wrap(_tablet/_mobile): "nowrap"` where needed.
- Button widget defaults to the global "Labels" typography (uppercase) → set button typography and `border_radius` on the widget.
- Kit CSS (`post-6.css`) can stay stale → set critical styles on widgets too, then clear cache.
- Keep Elementor-editor JavaScript calls small; big `elementor.widgetsCache` queries freeze the tab.
- The Chrome window can't go narrower than about 500 px — check phone layout on a real device.

## 6. Next steps if the job is awarded

1. Activate Elementor Pro on Sinapi's licence (Advanced Solo or higher).
2. Install JetEngine + JetSmartFilters; set up post types Products, Training levels, Videos, Documents with relations; turn tabs and downloads into Listings / Loop Grids fed by entries.
3. Move the header and footer into Theme Builder templates.
4. Build the remaining pages: product hub, library with filters, resources, procurement, contact, request access.
5. Bunny Stream for gated videos; WPML only when a second language is needed.
6. Optional Phase 3: the Lovable app.

## 7. Money

| Item | Amount |
|---|---|
| Phase 1 Design & UX | R 20 250 |
| Phase 2 Website build | R 45 750 |
| **Website total** | **R 66 000** |
| Phase 3 Training app (optional) | R 53 250 |
| Care | Essential R 950 / Full R 2 250 per month · App care R 850 per month |

Rate R 750/hour. Licences paid by Sinapi: Elementor Pro Advanced Solo $84/yr, JetEngine $75/yr, JetSmartFilters $75/yr, Bunny Stream ±$1–5/month, WPML CMS €99/yr (later).

- Dashboard quotes: QTN_003 (Design & UX), QTN_004 (Website build), QTN_005 (App) — drafts, 60% deposit.
- Dashboard proposals: **D317A1B5** (the link sent to the client) now holds **v2.1** — with the Design ownership clause (R 25 000 design release fee), Hetzner hosting and member-area option. Concepts board **10EB71C3**.
- To update a proposal without changing its link, use **Replace file** on the Proposals page (`PUT /api/proposals/:id/file`).
- Full notes also in the claude.ai project "Sinapi proposal": `claude/sinapi-elementor-site-handover.md` and `claude/sinapi-proposal-summary.md`.
