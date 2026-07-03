import { getEnv } from './env'
import { slugify } from './slug'
import type { EntityGraph, GuruNode, ProductNode, PublisherNode } from './directory'

/**
 * Promo Analyzer's entity directory (`GET /api/entities`) is the reconciled
 * publisher → gurus/products graph: the Financial Publishing Directory unioned
 * with values actually used on reviews, with the publisher's merge/rename/assign
 * overrides applied and per-entity review counts. It is a superset of the raw
 * directory markdown and self-corrects as the brain learns — so FID uses it as
 * its entity spine, then overlays strategies/topics from the directory.
 *
 * Never throws — returns null on any failure so FID falls back to directory-only.
 */

const REVALIDATE = 300

interface ApiProduct {
  name: string
  pubCode?: string
  reviewCount?: number
  guru?: string
}
interface ApiGuru {
  name: string
  reviewCount?: number
}
interface ApiPublisher {
  name: string
  gurus?: ApiGuru[]
  products?: ApiProduct[]
  reviewCount?: number
}
interface ApiResponse {
  publishers?: ApiPublisher[]
  unassigned?: { gurus?: ApiGuru[]; products?: ApiProduct[] }
  removed?: { kind: string; name: string }[]
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\t\n]/g, ' ').trim()
}

export async function getEntitiesGraph(): Promise<EntityGraph | null> {
  const base = getEnv('PROMO_API_URL')?.replace(/\/$/, '')
  if (!base) return null
  let data: ApiResponse
  try {
    const res = await fetch(`${base}/api/entities`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    data = (await res.json()) as ApiResponse
  } catch {
    return null
  }
  if (!data?.publishers) return null

  const removed = new Set(
    (data.removed || []).map((r) => `${r.kind}:${slugify(cleanName(r.name))}`)
  )
  const isRemoved = (kind: string, name: string) => removed.has(`${kind}:${slugify(name)}`)

  const gurus = new Map<string, GuruNode>()
  const products = new Map<string, ProductNode>()
  const publishers = new Map<string, PublisherNode>()

  const guru = (name: string): GuruNode => {
    const slug = slugify(name)
    if (!gurus.has(slug))
      gurus.set(slug, { name, slug, publishers: [], products: [], strategies: [], topics: [] })
    return gurus.get(slug)!
  }
  const product = (name: string, code?: string, publisher?: string): ProductNode => {
    const slug = slugify(name)
    if (!products.has(slug))
      products.set(slug, {
        name,
        slug,
        code: code || undefined,
        publisher: publisher || '',
        gurus: [],
        strategies: [],
        topics: [],
        aliases: [],
      })
    const p = products.get(slug)!
    if (code && !p.code) p.code = code
    if (publisher && !p.publisher) p.publisher = publisher
    return p
  }
  const uniqPush = (arr: string[], v?: string) => {
    if (v && !arr.includes(v)) arr.push(v)
  }

  for (const pub of data.publishers) {
    const pubName = cleanName(pub.name)
    if (!pubName || isRemoved('publisher', pubName)) continue
    const pubSlug = slugify(pubName)
    if (!publishers.has(pubSlug))
      publishers.set(pubSlug, { name: pubName, slug: pubSlug, gurus: [], products: [] })
    const pubNode = publishers.get(pubSlug)!

    for (const g of pub.gurus || []) {
      const gName = cleanName(g.name)
      if (!gName || isRemoved('guru', gName)) continue
      uniqPush(pubNode.gurus, gName)
      uniqPush(guru(gName).publishers, pubName)
    }
    for (const pr of pub.products || []) {
      const prName = cleanName(pr.name)
      if (!prName || isRemoved('product', prName)) continue
      uniqPush(pubNode.products, prName)
      const pNode = product(prName, pr.pubCode, pubName)
      if (pr.guru) {
        const gName = cleanName(pr.guru)
        if (!isRemoved('guru', gName)) {
          uniqPush(pNode.gurus, gName)
          uniqPush(guru(gName).products, prName)
          uniqPush(guru(gName).publishers, pubName)
        }
      }
    }
  }

  return {
    gurus: [...gurus.values()].sort((a, b) => a.name.localeCompare(b.name)),
    products: [...products.values()].sort((a, b) => a.name.localeCompare(b.name)),
    publishers: [...publishers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    rows: [],
  }
}
