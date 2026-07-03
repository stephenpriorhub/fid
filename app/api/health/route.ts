import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { getDirectoryPath } from '@/lib/vault'
import { checkSources } from '@/lib/source-health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sources = await checkSources()
  const sourcesOk = sources.every((s) => s.ok)
  return NextResponse.json({
    // Core liveness stays true even if a data source is down — the app still serves.
    ok: true,
    vaultDirectoryPresent: existsSync(getDirectoryPath()),
    sourcesOk,
    sources,
    ts: new Date().toISOString(),
  })
}
