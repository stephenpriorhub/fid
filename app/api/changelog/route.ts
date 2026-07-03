import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyHubSession } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'

// POST: accept either the sync-vault webhook (X-Webhook-Secret) or an authed hub session.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  const expected = process.env.CHANGELOG_WEBHOOK_SECRET

  let allowed = false
  if (expected && secret === expected) {
    allowed = true
  } else {
    const { authorized } = await verifyHubSession(req.headers.get('cookie') || '')
    allowed = authorized
  }
  if (!allowed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const entry = await prisma.changelogEntry.create({
    data: {
      title: body.title ?? 'Update',
      description: body.description ?? null,
      pageSlug: body.pageSlug ?? null,
      source: body.source ?? 'fid',
      brainSha: body.brainSha ?? null,
    },
  })
  return NextResponse.json(entry, { status: 201 })
}

export async function GET(req: NextRequest) {
  const { authorized } = await verifyHubSession(req.headers.get('cookie') || '')
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)
  const entries = await prisma.changelogEntry.findMany({
    orderBy: { date: 'desc' },
    take: limit,
  })
  return NextResponse.json(entries)
}
