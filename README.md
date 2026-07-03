# FID — FinPub Intelligence Database

A one-look intelligence briefing on any **guru, product, or publisher** across the
financial-publishing industry. Modeled on the MTA Wiki but:

- **No track record / claims** — dated performance tables and Airtable claims are excluded.
- **Whole industry** — every entity in the brain's `Financial Publishing Directory.md`
  (MTA + competitors: Oxford Club, MarketWise, Paradigm, Banyan Hill, …).
- **Emails + promos attached** — each page shows **recent emails** (from iSpy, with a
  "view all" deep link into iSpy's filtered search) and analyzed **promos** (from Promo Analyzer).
- **It grows the brain** — a scheduled pipeline mines full promo copy for deeper bios and
  product USPs and writes them back into the brain autonomously.

## Data sources (joined on canonical name strings)

| Source | How | Used for |
|--------|-----|----------|
| Brain vault (git-synced) | markdown at `$VAULT_PATH/Resources/…` | entity graph, bios, product notes |
| iSpy Emails | `GET {ISPY_API_URL}/api/emails` etc. | recent emails per entity |
| Promo Analyzer | `GET {PROMO_API_URL}/api/reviews` | promos per entity |
| Brain API / GitHub | `POST {BRAIN_API_URL}/api/intelligence` (`kind: finpub-enrichment`) or Contents API | enrichment write-back |

Key brain files: `Resources/Financial Publishing Directory.md` (the entity spine),
`Resources/Experts/*.md` + `Resources/Competitors/*.md` (gurus),
`Resources/Publication Descriptions/*.md` (products).

## Architecture

Next.js 16 (standalone) + Prisma/Postgres (changelog + enrichment audit log only). All pages
are `force-dynamic` and read the vault + live APIs at request time, so content stays fresh as
the brain and the other apps accumulate data — no redeploy needed.

- `lib/directory.ts` — parses the directory table → guru/product/publisher graph (collapses aliases).
- `lib/gurus.ts` / `lib/products.ts` — parse profile markdown; `lib/markdown.ts` strips the
  claims/track-record + housekeeping sections (hierarchy-aware).
- `lib/ispy.ts` / `lib/promos.ts` — live clients (cached 300s), never throw.
- `lib/enrich.ts` + `lib/brain-api.ts` — enrichment pass → brain write-back.

## Local dev

```sh
npm install
npx prisma generate
VAULT_PATH=~/github/brain DATABASE_URL=postgresql://localhost:5432/fid npm run dev
```

## Environment variables

See `.env.example`. Notable: `VAULT_PATH`, `BRAIN_REPO_URL`, `GITHUB_TOKEN`, `DATABASE_URL`,
`HUB_URL`, `HUB_PROJECT_ID`, `ISPY_API_URL`/`ISPY_APP_URL`, `PROMO_API_URL`,
`BRAIN_API_URL`, `HUB_API_TOKEN`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `CHANGELOG_WEBHOOK_SECRET`.

## Enrichment

`GET /api/cron/enrich` (auth: `Authorization: Bearer $CRON_SECRET` or admin hub session):
- `?entity=<name>&type=guru|product` — one entity
- `?type=guru|product&limit=N` — a batch

Writes into a `<!-- finpub:start/end -->` marker block in the entity's brain note and logs
every write to the `EnrichmentLog` table. No human-approval gate.

> **Coordination:** the Brain API `kind: "finpub-enrichment"` handler must be added in the
> brain-map app (owner: Brain Master). Until then the client falls back to a direct GitHub
> Contents API write into the marker block (`GITHUB_TOKEN` + `BRAIN_REPO_URL`).

## Deploy (Railway)

nixpacks; `npm run build`; pre-deploy `prisma migrate deploy`; start `npm run start:prod`
(syncs vault in background then serves). Mount a volume at `VAULT_PATH`. Domain: `fid.oxfordhub.app`.
