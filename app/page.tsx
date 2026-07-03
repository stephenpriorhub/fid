import { getGraph } from '@/lib/directory'
import { checkSources } from '@/lib/source-health'
import DirectoryBrowser, { type EntityItem } from '@/components/DirectoryBrowser'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const [graph, sources] = await Promise.all([getGraph(), checkSources()])
  const down = sources.filter((s) => !s.ok)

  const items: EntityItem[] = [
    ...graph.gurus.map<EntityItem>((g) => ({
      type: 'guru',
      name: g.name,
      slug: g.slug,
      sub: g.publishers.join(' · '),
      topics: g.topics,
    })),
    ...graph.products.map<EntityItem>((p) => ({
      type: 'product',
      name: p.name,
      slug: p.slug,
      code: p.code,
      sub: [p.publisher, ...p.gurus].filter(Boolean).join(' · '),
      topics: p.topics,
    })),
    ...graph.publishers.map<EntityItem>((p) => ({
      type: 'publisher',
      name: p.name,
      slug: p.slug,
      sub: `${p.gurus.length} gurus · ${p.products.length} products`,
      topics: [],
    })),
  ]

  const initialType =
    type === 'guru' || type === 'product' || type === 'publisher' ? type : 'all'

  return (
    <div>
      {down.length > 0 && (
        <div className="mb-5 rounded-lg border border-[var(--bad)] bg-[var(--bad)]/10 px-4 py-3 text-sm">
          <span className="font-semibold text-[var(--bad)]">Data source issue:</span>{' '}
          {down
            .map((s) => `${s.name} unreachable${s.status ? ` (HTTP ${s.status})` : ''}`)
            .join('; ')}
          . Promos/emails may be incomplete until this is resolved.
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">FinPub Intelligence Database</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Intelligence briefings across {graph.gurus.length} gurus, {graph.products.length}{' '}
          products, and {graph.publishers.length} publishers — updated automatically as the brain
          grows.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No directory data found. Ensure the brain vault is synced (VAULT_PATH →{' '}
          <code>Resources/Financial Publishing Directory.md</code>).
        </p>
      ) : (
        <DirectoryBrowser items={items} initialType={initialType} />
      )}
    </div>
  )
}
