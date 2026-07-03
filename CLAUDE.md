# FID — Agent Instructions

FinPub Intelligence Database. Internal OxfordHub app. See `README.md` for architecture.

## Invariants
- **No track record / claims.** Guru pages must never render dated performance tables, win-rate
  claim records, or Airtable claims/testimonials embeds. `lib/markdown.ts` enforces this
  (hierarchy-aware section exclusion + Airtable line scrub). If you add sections, keep it holding.
- **Read-only toward source apps.** FID only *reads* iSpy (`/api/emails`) and Promo Analyzer
  (`/api/reviews`); it does not write to them. All clients must be graceful (never throw).
- **Entity keys are canonical name strings**, matching `promo-analyzer/lib/canonical-entities.json`.
  The entity spine is `Resources/Financial Publishing Directory.md` in the brain.
- **Autonomous brain learning.** The enrichment pipeline writes to the brain with no human-approval
  gate, into `<!-- finpub:start/end -->` marker blocks only — never clobber other agents' sections
  (`owner:claims-integrity`, `ispy:*`).

## Repo hygiene
- One checkout at `~/github/fid`, SSH remote (`git@github.com:stephenpriorhub/fid.git`).
- Never commit `tsconfig.tsbuildinfo` (Railway Next.js build footgun) — already gitignored.

## Open items
- Brain API `kind: "finpub-enrichment"` handler needs adding in brain-map (coordinate with Brain
  Master). Until then enrichment uses the GitHub Contents API fallback.
- Product USP enrichment needs `.md` product notes in `Resources/Publication Descriptions/`;
  several products are currently `.docx` only (fallback description shown).
