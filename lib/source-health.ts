import { getEnv } from './env'

/**
 * Liveness of FID's external data sources. FID's clients fail soft (empty data on
 * error) so a page always renders — but that means an upstream lockdown (e.g. an
 * API-wide auth wall) can silently empty the app. This surfaces that: /api/health
 * reports it for monitoring, and the home page shows a banner when a source is down.
 */

export interface SourceStatus {
  name: string
  ok: boolean
  status: number | null
  detail?: string
}

async function probe(name: string, url: string | undefined): Promise<SourceStatus> {
  if (!url) return { name, ok: false, status: null, detail: 'not configured' }
  const token = getEnv('HUB_API_TOKEN')
  try {
    const res = await fetch(url, {
      headers: token ? { 'x-hub-token': token } : {},
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    let detail: string | undefined
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      detail = body.slice(0, 120) || `HTTP ${res.status}`
    }
    return { name, ok: res.ok, status: res.status, detail }
  } catch (e) {
    return { name, ok: false, status: null, detail: e instanceof Error ? e.message : 'unreachable' }
  }
}

/** Probe every data source in parallel. Cheap, short-timeout, never throws. */
export async function checkSources(): Promise<SourceStatus[]> {
  const promo = getEnv('PROMO_API_URL')?.replace(/\/$/, '')
  const ispy = getEnv('ISPY_API_URL')?.replace(/\/$/, '')
  return Promise.all([
    probe('Promo Analyzer', promo ? `${promo}/api/entities` : undefined),
    probe('iSpy Emails', ispy ? `${ispy}/api/gurus` : undefined),
  ])
}
