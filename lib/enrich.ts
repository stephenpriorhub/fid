import Anthropic from '@anthropic-ai/sdk'
import { relative } from 'path'
import { getEnv } from './env'
import { getVaultPath } from './vault'
import { getGraph } from './directory'
import { getGuruProfile } from './gurus'
import { getProductProfile } from './products'
import {
  getPromosForGuru,
  getPromosForProduct,
  getPromosForPublisher,
  type PromoReview,
} from './promos'
import { writeEnrichment, type WriteResult } from './brain-api'
import { prisma } from './prisma'

const MODEL = getEnv('FID_ENRICH_MODEL') || 'claude-opus-4-8'

function promoCorpus(promos: PromoReview[], max = 14): string {
  return promos
    .slice(0, max)
    .map((r, i) => {
      const s = r.sections || {}
      const parts = [
        `### Promo ${i + 1}: ${r.displayName || r.filename}`,
        r.product ? `Product: ${r.product}` : '',
        s.headline ? `Headline: ${s.headline}` : '',
        // outline + evaldo + cub carry the guru bio/backstory/credibility copy —
        // these are the sections to mine for biographical detail.
        s.outline ? `Outline:\n${s.outline}` : '',
        s.evaldo ? `Full copy / evaluation:\n${s.evaldo}` : '',
        s.cub ? `Copy breakdown:\n${s.cub}` : '',
        s.offer ? `Offer:\n${s.offer}` : '',
        s.promoIntel ? `Intel:\n${s.promoIntel}` : '',
      ].filter(Boolean)
      return parts.join('\n')
    })
    .join('\n\n')
    .slice(0, 40000) // digest more of the full promo copy
}

const GURU_SYSTEM = `You are an intelligence analyst profiling a financial-publishing GURU. Promotional copy is where these gurus tell their life story — mine the bio/backstory sections thoroughly and build the richest factual biography the copy supports.

Extract and organize:
- **Background & career**: origin story, prior firms/roles, credentials, education, notable career moments, personal details used to build credibility.
- **How they're positioned**: the persona/angle the copy sells (the "who is this person" pitch), signature methods/mechanisms, recurring themes they talk about.

Rules:
- Pull as much biographical detail as the copy provides — this is the priority.
- Do NOT restate performance/track-record claims, win-rate numbers, or specific return figures.
- Do NOT frame anything around Monument Traders Alliance or "strategic relevance to MTA" — this is a neutral profile of the guru, not a competitive comparison.
- Do NOT invent facts; only use what the copy states.
Output tight markdown (headings + bullets), up to ~350 words. If the copy adds nothing beyond what's already known, output a single line: NO NEW INTEL.`

const PRODUCT_SYSTEM = `You are an intelligence analyst for a financial-publishing company. From the promotional copy provided, extract what this PRODUCT actually is and its unique selling propositions (USPs). Focus on: the core mechanism/strategy, what the subscriber gets, the differentiators/positioning, target audience, and the offer structure. Do NOT restate performance/track-record claims or win-rate numbers. Do NOT invent facts. Output tight markdown (headings + bullets), 150-300 words. If the copy adds nothing new, output a single line: NO NEW INTEL.`

const PUBLISHER_SYSTEM = `You are an intelligence analyst profiling a financial-publishing PUBLISHER (the "house"). From the promotional copy across its products, build a house-level intelligence brief:
- **What the house is**: its identity, the brands/newsletters and gurus it runs, its overall market positioning.
- **Recurring themes & angles**: the topics, hooks, and promotional patterns that show up across its promos.
- **Target audience & offer style**: who it sells to and how (front-end vs high-ticket, webinar vs VSL, guarantee patterns).

Rules:
- Synthesize across the promos; note patterns that appear in multiple.
- Do NOT restate performance/track-record claims or specific return figures.
- Do NOT frame around Monument Traders Alliance or "strategic relevance to MTA".
- Do NOT invent facts.
Output tight markdown (headings + bullets), up to ~300 words. If the copy adds nothing new, output a single line: NO NEW INTEL.`

async function runModel(system: string, user: string): Promise<string | null> {
  const apiKey = getEnv('ANTHROPIC_API_KEY')
  if (!apiKey) return null
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return text || null
  } catch (e) {
    console.warn('[enrich] model error:', e instanceof Error ? e.message : e)
    return null
  }
}

function repoRelative(absPath?: string): string | null {
  if (!absPath) return null
  const rel = relative(getVaultPath(), absPath)
  return rel.startsWith('..') ? null : rel
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Minimal, convention-conforming stub note created when a guru/product has promo
 * activity but no brain note yet. Includes empty `ispy` markers (so the iSpy email
 * pipeline can populate "Currently Talking About") and `finpub` markers (spliced by
 * the writer). The curated body is left for Brain Master; FID only owns finpub.
 */
function guruStub(name: string, publisher: string | undefined, isMTA: boolean): string {
  const pubLink = publisher ? ` · [[${publisher}]]` : ''
  return `---
status: active
tags: [${isMTA ? 'editor' : 'competitor'}]
created: ${today()}
updated: ${today()}
source: fid-autoseed
---

<!-- Auto-seeded by FID from promo/email activity. Brain Master: curate the body.
     Machine writers append only inside their marker blocks. -->

# ${name}

**Role**: Editor${pubLink}

## iSpy — Currently Talking About
<!-- ispy:start -->
<!-- ispy:end -->

## FinPub Intel — Bio & Positioning
<!-- finpub:start -->
<!-- finpub:end -->

## Log
- **${today()}** — Auto-seeded by FID from promo activity.
`
}

function publisherStub(name: string, gurus: string[], products: string[]): string {
  return `---
type: publisher
status: active
created: ${today()}
updated: ${today()}
source: fid-autoseed
---

<!-- Auto-seeded by FID from promo activity. Brain Master: curate the body. -->

# ${name}

${gurus.length ? `**Gurus:** ${gurus.map((g) => `[[${g}]]`).join(', ')}` : ''}
${products.length ? `**Products:** ${products.map((p) => `[[${p}]]`).join(', ')}` : ''}

## FinPub Intel — House Brief
<!-- finpub:start -->
<!-- finpub:end -->

## Log
- **${today()}** — Auto-seeded by FID from promo activity.
`
}

function productStub(name: string, code: string | undefined, publisher: string, gurus: string[]): string {
  return `---
type: publication
status: active
created: ${today()}
updated: ${today()}
source: fid-autoseed
---

<!-- Auto-seeded by FID from promo activity. Brain Master: curate the body. -->

# ${name}${code ? ` [${code}]` : ''}

**Parent Company:** ${publisher ? `[[${publisher}]]` : 'Unknown'}
${gurus.length ? `**Guru:** ${gurus.map((g) => `[[${g}]]`).join(', ')}` : ''}

## USPs (FinPub)
<!-- finpub:start -->
<!-- finpub:end -->

## Log
- **${today()}** — Auto-seeded by FID from promo activity.
`
}

export interface EnrichOutcome {
  entityType: 'guru' | 'product' | 'publisher'
  entityName: string
  status: 'written' | 'no-target' | 'no-new-intel' | 'no-promos' | 'model-skipped' | 'write-failed'
  write?: WriteResult
  promoCount: number
}

async function log(o: EnrichOutcome) {
  try {
    await prisma.enrichmentLog.create({
      data: {
        entityType: o.entityType,
        entityName: o.entityName,
        target: o.write?.target || o.status,
        summary: o.status,
        bytes: o.write?.bytes || 0,
        ok: o.status === 'written',
        error: o.write?.error,
        promoCount: o.promoCount,
      },
    })
  } catch {
    /* audit log is best-effort */
  }
}

export async function enrichGuru(name: string): Promise<EnrichOutcome> {
  const promos = await getPromosForGuru(name)
  if (promos.length === 0) {
    const o: EnrichOutcome = { entityType: 'guru', entityName: name, status: 'no-promos', promoCount: 0 }
    await log(o)
    return o
  }
  const profile = getGuruProfile(name)
  const node = (await getGraph()).gurus.find((g) => g.name === name)
  const existingPath = repoRelative(profile.sourcePath)

  // Self-seed a note when one doesn't exist yet, so every guru with activity gets
  // a profile that both FID and the iSpy email pipeline can keep teaching.
  let repoPath = existingPath
  let stub: string | undefined
  if (!repoPath) {
    const publisher = node?.publishers[0]
    const isMTA = (node?.publishers || []).some((p) => /monument traders/i.test(p))
    repoPath = `Resources/${isMTA ? 'Experts' : 'Competitors'}/${name}.md`
    stub = guruStub(name, publisher, isMTA)
  }

  const known = profile.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n').slice(0, 8000)
  const user = `GURU: ${name}\n\nALREADY IN THE BRAIN (do not repeat):\n${known || '(none)'}\n\nPROMOTIONAL COPY:\n${promoCorpus(promos)}`
  const out = await runModel(GURU_SYSTEM, user)
  const hasIntel = !!out && !/^NO NEW INTEL/i.test(out.trim())

  // Existing note + nothing new → skip. New note → seed it even without fresh bio,
  // so the profile exists for future enrichment + the email pipeline.
  if (!hasIntel && existingPath) {
    const o: EnrichOutcome = {
      entityType: 'guru',
      entityName: name,
      status: out ? 'no-new-intel' : 'model-skipped',
      promoCount: promos.length,
    }
    await log(o)
    return o
  }
  const stamped = hasIntel
    ? `${out!.trim()}\n\n_Last enriched by FID from ${promos.length} promo(s)._`
    : `_Auto-seeded from ${promos.length} promo(s); bio pending next enrichment._`
  const write = await writeEnrichment({ entityType: 'guru', entityName: name, repoPath, markdown: stamped, stub })
  const o: EnrichOutcome = {
    entityType: 'guru',
    entityName: name,
    status: write.ok ? 'written' : 'write-failed',
    write,
    promoCount: promos.length,
  }
  await log(o)
  return o
}

export async function enrichProduct(name: string): Promise<EnrichOutcome> {
  const node = (await getGraph()).products.find((p) => p.name === name)
  const promos = await getPromosForProduct(name, node?.aliases || [])
  if (promos.length === 0) {
    const o: EnrichOutcome = { entityType: 'product', entityName: name, status: 'no-promos', promoCount: 0 }
    await log(o)
    return o
  }
  const profile = getProductProfile(name, node?.code)
  const existingPath = repoRelative(profile.sourcePath)

  let repoPath = existingPath
  let stub: string | undefined
  if (!repoPath) {
    repoPath = `Resources/Publication Descriptions/${name}.md`
    stub = productStub(name, node?.code, node?.publisher || '', node?.gurus || [])
  }

  const known = profile.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n').slice(0, 8000)
  const user = `PRODUCT: ${name}\n\nALREADY IN THE BRAIN (do not repeat):\n${known || '(none)'}\n\nPROMOTIONAL COPY:\n${promoCorpus(promos)}`
  const out = await runModel(PRODUCT_SYSTEM, user)
  const hasIntel = !!out && !/^NO NEW INTEL/i.test(out.trim())

  if (!hasIntel && existingPath) {
    const o: EnrichOutcome = {
      entityType: 'product',
      entityName: name,
      status: out ? 'no-new-intel' : 'model-skipped',
      promoCount: promos.length,
    }
    await log(o)
    return o
  }
  const stamped = hasIntel
    ? `${out!.trim()}\n\n_Last enriched by FID from ${promos.length} promo(s)._`
    : `_Auto-seeded from ${promos.length} promo(s); USPs pending next enrichment._`
  const write = await writeEnrichment({ entityType: 'product', entityName: name, repoPath, markdown: stamped, stub })
  const o: EnrichOutcome = {
    entityType: 'product',
    entityName: name,
    status: write.ok ? 'written' : 'write-failed',
    write,
    promoCount: promos.length,
  }
  await log(o)
  return o
}

export async function enrichPublisher(name: string): Promise<EnrichOutcome> {
  const promos = await getPromosForPublisher(name)
  if (promos.length === 0) {
    const o: EnrichOutcome = { entityType: 'publisher', entityName: name, status: 'no-promos', promoCount: 0 }
    await log(o)
    return o
  }
  const node = (await getGraph()).publishers.find((p) => p.name === name)
  // Publishers are derived entities — always self-seed a house note under Publishers/.
  const repoPath = `Resources/Publishers/${name}.md`
  const stub = publisherStub(name, node?.gurus || [], node?.products || [])

  const user = `PUBLISHER (house): ${name}\nGurus: ${(node?.gurus || []).join(', ') || '(unknown)'}\nProducts: ${(node?.products || []).join(', ') || '(unknown)'}\n\nPROMOTIONAL COPY ACROSS ITS PRODUCTS:\n${promoCorpus(promos)}`
  const out = await runModel(PUBLISHER_SYSTEM, user)
  const hasIntel = !!out && !/^NO NEW INTEL/i.test(out.trim())
  const stamped = hasIntel
    ? `${out!.trim()}\n\n_Last enriched by FID from ${promos.length} promo(s) across the house._`
    : `_Auto-seeded from ${promos.length} promo(s); house brief pending next enrichment._`
  const write = await writeEnrichment({ entityType: 'publisher', entityName: name, repoPath, markdown: stamped, stub })
  const o: EnrichOutcome = {
    entityType: 'publisher',
    entityName: name,
    status: write.ok ? 'written' : 'write-failed',
    write,
    promoCount: promos.length,
  }
  await log(o)
  return o
}
