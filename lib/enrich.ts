import Anthropic from '@anthropic-ai/sdk'
import { relative } from 'path'
import { getEnv } from './env'
import { getVaultPath } from './vault'
import { getGraph } from './directory'
import { getGuruProfile } from './gurus'
import { getProductProfile } from './products'
import { getPromosForGuru, getPromosForProduct, type PromoReview } from './promos'
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

export interface EnrichOutcome {
  entityType: 'guru' | 'product'
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
  const repoPath = repoRelative(profile.sourcePath)
  if (!repoPath) {
    const o: EnrichOutcome = { entityType: 'guru', entityName: name, status: 'no-target', promoCount: promos.length }
    await log(o)
    return o
  }
  const known = profile.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n').slice(0, 8000)
  const user = `GURU: ${name}\n\nALREADY IN THE BRAIN (do not repeat):\n${known || '(none)'}\n\nPROMOTIONAL COPY:\n${promoCorpus(promos)}`
  const out = await runModel(GURU_SYSTEM, user)
  if (!out) {
    const o: EnrichOutcome = { entityType: 'guru', entityName: name, status: 'model-skipped', promoCount: promos.length }
    await log(o)
    return o
  }
  if (/^NO NEW INTEL/i.test(out.trim())) {
    const o: EnrichOutcome = { entityType: 'guru', entityName: name, status: 'no-new-intel', promoCount: promos.length }
    await log(o)
    return o
  }
  const stamped = `${out.trim()}\n\n_Last enriched by FID from ${promos.length} promo(s)._`
  const write = await writeEnrichment({ entityType: 'guru', entityName: name, repoPath, markdown: stamped })
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
  const repoPath = repoRelative(profile.sourcePath)
  if (!repoPath) {
    const o: EnrichOutcome = { entityType: 'product', entityName: name, status: 'no-target', promoCount: promos.length }
    await log(o)
    return o
  }
  const known = profile.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n').slice(0, 8000)
  const user = `PRODUCT: ${name}\n\nALREADY IN THE BRAIN (do not repeat):\n${known || '(none)'}\n\nPROMOTIONAL COPY:\n${promoCorpus(promos)}`
  const out = await runModel(PRODUCT_SYSTEM, user)
  if (!out) {
    const o: EnrichOutcome = { entityType: 'product', entityName: name, status: 'model-skipped', promoCount: promos.length }
    await log(o)
    return o
  }
  if (/^NO NEW INTEL/i.test(out.trim())) {
    const o: EnrichOutcome = { entityType: 'product', entityName: name, status: 'no-new-intel', promoCount: promos.length }
    await log(o)
    return o
  }
  const stamped = `${out.trim()}\n\n_Last enriched by FID from ${promos.length} promo(s)._`
  const write = await writeEnrichment({ entityType: 'product', entityName: name, repoPath, markdown: stamped })
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
