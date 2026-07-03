import { NextRequest, NextResponse } from 'next/server'
import { getGraph } from '@/lib/directory'
import { enrichGuru, enrichProduct, type EnrichOutcome } from '@/lib/enrich'
import { verifyHubSession, isAdmin } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Autonomous enrichment run. Mines full promo copy → deepened guru bios + product USPs →
 * writes back into the brain (finpub marker block). No human-approval gate.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (for the scheduler) OR an admin hub session.
 * Scope:
 *   ?entity=<name>&type=guru|product   → enrich one entity
 *   ?type=guru|product&limit=N          → enrich a batch (default 25)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  let allowed = !!secret && auth === `Bearer ${secret}`
  if (!allowed) {
    const { authorized, user } = await verifyHubSession(req.headers.get('cookie') || '')
    allowed = authorized && isAdmin(user)
  }
  if (!allowed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const type = sp.get('type')
  const entity = sp.get('entity')
  const limit = Math.min(parseInt(sp.get('limit') ?? '25'), 100)
  const graph = await getGraph()
  const results: EnrichOutcome[] = []

  if (entity) {
    if (type === 'product') results.push(await enrichProduct(entity))
    else results.push(await enrichGuru(entity))
  } else {
    const gurus = type === 'product' ? [] : graph.gurus.slice(0, limit).map((g) => g.name)
    const products = type === 'guru' ? [] : graph.products.slice(0, limit).map((p) => p.name)
    for (const g of gurus) results.push(await enrichGuru(g))
    for (const p of products) results.push(await enrichProduct(p))
  }

  const written = results.filter((r) => r.status === 'written').length
  return NextResponse.json({ ran: results.length, written, results })
}
