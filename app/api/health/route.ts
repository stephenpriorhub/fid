import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { getDirectoryPath } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    vaultDirectoryPresent: existsSync(getDirectoryPath()),
    ts: new Date().toISOString(),
  })
}
