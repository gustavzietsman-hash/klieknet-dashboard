---
name: tenant-power
description: Build, deploy, maintain and extend Tenant Power — Gustav's tenant electricity sub-meter billing app at power.klieknet.com (Node + SQLite on Hetzner/Coolify). Use for any change to the app, a deploy, adding the yearly 1 July municipal tariffs, importing a tenant's old readings, reconciling a municipal statement against the solar report, or Phase 3 white-label work.
---

# Tenant Power — how to work on it

Tenant Power bills tenants for electricity measured on their **DB-box sub-meter**, using the **municipal block tariff** in force for each month. Gustav is the admin; tenants get their own login and send monthly readings with a meter photo.

## 1. Where everything lives

| What | Where |
|---|---|
| Live app | https://power.klieknet.com (health check: `/health`) |
| Code | GitHub `gustavzietsman-hash/tenant-power`, branch `main` |
| Local copy (iMac) | `~/Documents/tenant-power` |
| Hosting | Hetzner CX23 `188.245.20.166` → Coolify (`https://coolify.klieknet.com`) → project *My first project* → app *tenant-power* |
| Build | `Dockerfile` (node:22-bookworm-slim), port **3000** |
| Data | Coolify volume `tenant-power` mounted at **`/data`**: `tenant-power.db` (SQLite) + `uploads/` (meter photos) |
| DNS | Xneelo A record `power` → `188.245.20.166` |
| Env vars (Coolify) | `DATA_DIR=/data`, `APP_URL=https://power.klieknet.com`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (first boot only) |
| Phase 3 plan | `docs/phase3-white-label.md` in the repo; also in Claude project "Electricity dashboard" and the KliekNet dashboard → Projects |
| Server guide | `klieknet-hetzner-deployment-guide.md` (Gustav's Desktop) |

## 2. How the code is organised

- `server.js` — Express API + static files. Auth = signed cookie session (`cookie-session`), bcrypt passwords, roles `admin` / `tenant`. Tenants only see their own unit (`canSeeTenant`).
- `lib/db.js` — schema + **additive** migrations that run on every start (tables: users, tenants, readings, payments, tariffs, invites, submissions, solar_months). Seeds Stellenbosch DOM4 tariffs.
- `lib/calc.js` — the block-tariff engine. Rates are **VAT-inclusive R/kWh**; blocks are `[{upTo, rate}]`, last block `upTo: null`. `pickTariff()` chooses the latest version whose `effective_from` ≤ the first day of the reading's month.
- `lib/solar.js` — parses the Stage Zero "Solar vs Grid Comparison Report" PDF.
- `public/` — vanilla JS single-page app (hash routes), `styles.css`. **No inline handlers** (strict CSP) — use `data-action` attributes and the delegated listeners at the bottom of `app.js`.
- `scripts/test-calc.js` — `npm test`: checks the engine against real invoices. **Run it after any calculation change.**

Units: `tenants.kind` = `tenant` (sub-meter) or `household` (Gustav's own house, estimated from the solar app). `readings.paid_on` = month ticked as paid. Balance = billed − paid months − extra payments.

## 3. Deploy routine (Claude cannot push)

1. Make and test the change locally (run `node server.js` with a throwaway `DATA_DIR`, check with Playwright screenshots).
2. Copy the changed files into `~/Documents/tenant-power` on the Mac and commit there (end the message with the Co-Authored-By line).
3. **Gustav** runs: `cd ~/Documents/tenant-power && git push`
4. **Gustav**: Coolify → tenant-power → **Actions → Deploy** (auto-deploy webhook is not reliable), wait for *Running*, then Cmd+Shift+R.

Rules: never put data next to the code — everything writable goes under `DATA_DIR`. Keep migrations additive and safe to re-run. Never commit `node_modules`, `.env`, `*.db` or `uploads/`. If git on the Mac leaves `.git/*.lock` or `tmp_obj_*` files, remove them before handing over.

Gustav is not a developer: give **one step at a time**, exact clicks and copy-paste commands, and ask for a screenshot when unsure.

## 4. Yearly job — new tariffs every 1 July

1. Get the municipality's final tariff book for the new year (Stellenbosch: stellenbosch.gov.za → Budget → *Tariff By-law* / *Final Tariff Proposals* appendix). Category **DOM4 — Domestic: Regular, using Credit Meters**.
2. In the app: **Rates → Add a tariff version** — effective `YYYY-07-01`, basic fee (R/month incl VAT) and the four block rates (R/kWh **incl VAT**; blocks 0–50, 51–300, 301–600, >600).
3. **Verify** against the first municipal statement on the new rates: kWh × blocks must equal the "Electricity Consumption" line (excl and incl VAT). Record the check in the tariff's *verified* note.
4. Known values: 2025/26 = 2.1933 / 2.8134 / 3.9690 / 4.6736; 2026/27 = 2.3764 / 3.0483 / 4.3003 / 5.0640; basic fee R408.11. 2026/27 verified exactly: 962 kWh = R3,481.87 excl / R4,004.15 incl (invoice 17/09/2026, account 394950013).
5. **Open item:** 2023/24 and 2024/25 versions are PROVISIONAL estimates (2025/26 ÷ 1.1274, then ÷ 1.1272). Replace with the official figures when the tariff books are obtained — tenant totals recalculate automatically.

## 5. Common tasks

- **Import a tenant's old readings** (e.g. from an Excel sheet): one reading per month, `period` = the month label, `prev` = previous `curr`. Watch for Excel turning readings into dates (e.g. 2570.7 → 2570-07-01). Load through the API from Gustav's signed-in Chrome (`fetch('/api/tenants/:id/readings', …)`), then compare totals with the old flat-rate sheet and tell Gustav the difference. Ask whether past months are paid before leaving a balance that the tenant will see.
- **Give a tenant access**: tenant page → *Create invite link* → *Send on WhatsApp* (one-time link, 14 days).
- **Approve readings**: Tenants page → *Readings to approve*; the first submission needs a starting reading.
- **Municipal statement check**: municipal meter = grid import only, so compare it with the solar app's **Grid (kWh)**, not total use. Estimated-reading catch-ups show as a "Joernale" line; price disputes month-by-month on the block tariff.

## 6. Phase 3 (white-label) — when asked

Follow `docs/phase3-white-label.md`. Start with option **A** (separate Coolify instance + subdomain per client), first step a one-page product brief → KliekNet-branded proposal (use the `klieknet-brand` skill). Check resale-of-electricity rules (cost recovery only) and POPIA before selling.
