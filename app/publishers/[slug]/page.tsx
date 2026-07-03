import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findPublisherBySlug } from '@/lib/directory'
import { getPublisherContext } from '@/lib/publishers'
import { getPromosForPublisher } from '@/lib/promos'
import { getRecentEmails } from '@/lib/ispy'
import { slugify } from '@/lib/slug'
import PromoList from '@/components/PromoList'
import RecentEmails from '@/components/RecentEmails'
import { Card, Chip, TagLink } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function PublisherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const node = findPublisherBySlug(slug)
  if (!node) notFound()

  const ctx = getPublisherContext(node.name)
  const [promos, emails] = await Promise.all([
    getPromosForPublisher(node.name),
    getRecentEmails({ kind: 'publisher', name: node.name }),
  ])

  return (
    <div>
      <div className="mb-6">
        <Link href="/?type=publisher" className="text-xs text-[var(--muted)] hover:underline">
          ← Publishers
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold">{node.name}</h1>
          {ctx.family && <Chip tone="var(--accent)">{ctx.family} family</Chip>}
        </div>
        {ctx.note && <p className="text-sm text-[var(--muted)] mt-2">{ctx.note}</p>}
      </div>

      <Card title={`Gurus (${node.gurus.length})`}>
        {node.gurus.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {node.gurus.map((g) => (
              <TagLink key={g} href={`/gurus/${slugify(g)}`}>
                {g}
              </TagLink>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Products (${node.products.length})`}>
        {node.products.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {node.products.map((p) => (
              <TagLink key={p} href={`/products/${slugify(p)}`}>
                {p}
              </TagLink>
            ))}
          </div>
        )}
      </Card>

      <PromoList promos={promos} />
      <RecentEmails data={emails} />
    </div>
  )
}
