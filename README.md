# RefiSignal

RefiSignal is a client-side mortgage refinance intelligence app. It ingests a CSV/XLSX borrower file, confirms field mappings, normalizes the data, scores each record with deterministic refinance/equity logic, and exports filtered lead lists.

The app runs entirely in the browser. Uploaded mortgage/credit data is held in memory and is not sent to a backend.

## Features

- CSV/XLSX upload and preview
- Human-confirmed field mapping
- Mortgage-rate normalization, including basis-point values like `375 -> 3.75%`
- Data-quality report with missing-field and factor-spread warnings
- Editable market inputs and scoring thresholds
- Deterministic scoring with rate-term, second-lien, cash-out, watchlist, and suppression logic
- Blended-cost comparison for equity recommendations
- Dashboard, lead table, detail panel, and CSV export
- First-run guided tour with spotlight overlay and gated upload/scoring walkthrough

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## Build

```bash
npm run build
```

The production site is generated in `dist/`.

## GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

On pushes to `main`, the workflow:

1. Installs dependencies with `npm ci`
2. Builds the static app with `npm run build`
3. Publishes `dist/` to GitHub Pages

The Vite `base` path is derived from `GITHUB_REPOSITORY` during GitHub Actions builds, so project Pages URLs like `https://OWNER.github.io/REPO/` work without hardcoding the repo owner.

## Compliance Notes

This is an internal marketing-intelligence tool, not an underwriting or automated outbound platform. Estimated savings are for internal prioritization only and are not an offer, quote, or guarantee of savings or eligibility.
