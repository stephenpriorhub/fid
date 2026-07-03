import { getEnv } from './env'

/**
 * Promo Analyzer client. Fetches all reviews once (cached) and filters in-process
 * by guru / publisher / product — Promo Analyzer stores reviews as JSON and its
 * GET /api/reviews returns the full list. Never throws.
 */

const REVALIDATE = 300

export interface PromoReview {
  id: string
  filename: string
  displayName?: string
  date: string
  promoRunStartDate?: string
  promoCode?: string
  promoType?: string
  promoStatus?: string
  publisher?: string
  gurus?: string[]
  product?: string
  effectivenessScore?: number
  subScores?: { dimension: string; score: number }[]
  sections?: {
    offer?: string
    stockTease?: string
    effectiveness?: string
    headline?: string
    promoIntel?: string
  }
}

function apiUrl(): string | undefined {
  return getEnv('PROMO_API_URL')?.replace(/\/$/, '')
}
function authHeaders(): Record<string, string> {
  // Promo Analyzer's API is behind an OxfordHub auth wall (proxy.ts) that admits
  // server-to-server callers via the shared x-hub-token service identity.
  const token = getEnv('HUB_API_TOKEN')
  return token ? { 'x-hub-token': token } : {}
}

export async function getAllReviews(): Promise<PromoReview[]> {
  const base = apiUrl()
  if (!base) return []
  try {
    const res = await fetch(`${base}/api/reviews`, {
      headers: authHeaders(),
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return []
    const data = (await res.json()) as PromoReview[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const norm = (s?: string) => (s || '').trim().toLowerCase()

function sortByDateDesc(a: PromoReview, b: PromoReview): number {
  return (b.promoRunStartDate || b.date || '').localeCompare(a.promoRunStartDate || a.date || '')
}

export async function getPromosForGuru(name: string): Promise<PromoReview[]> {
  const target = norm(name)
  return (await getAllReviews())
    .filter((r) => (r.gurus || []).some((g) => norm(g) === target))
    .sort(sortByDateDesc)
}

export async function getPromosForProduct(
  name: string,
  aliases: string[] = []
): Promise<PromoReview[]> {
  const targets = new Set([norm(name), ...aliases.map(norm)])
  return (await getAllReviews())
    .filter((r) => targets.has(norm(r.product)))
    .sort(sortByDateDesc)
}

export async function getPromosForPublisher(name: string): Promise<PromoReview[]> {
  const target = norm(name)
  // Match on the publisher string, tolerating the "(Agora)" style family suffix.
  const bare = target.replace(/\s*\(.*\)$/, '')
  return (await getAllReviews())
    .filter((r) => {
      const p = norm(r.publisher)
      return p === target || p === bare || (p && (p.includes(bare) || bare.includes(p)))
    })
    .sort(sortByDateDesc)
}
