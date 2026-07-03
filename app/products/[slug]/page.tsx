import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findProductBySlug } from '@/lib/directory'
import { getProductProfile } from '@/lib/products'
import { getPromosForProduct } from '@/lib/promos'
import { getRecentEmails } from '@/lib/ispy'
import { slugify } from '@/lib/slug'
import Markdown from '@/components/Markdown'
import PromoList from '@/components/PromoList'
import RecentEmails from '@/components/RecentEmails'
import { Card, Chip, TagLink } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const node = await findProductBySlug(slug)
  if (!node) notFound()

  const [profile, promos, emails] = await Promise.all([
    Promise.resolve(getProductProfile(node.name, node.code)),
    getPromosForProduct(node.name, node.aliases),
    // Emails are captured against the iSpy "list" of the same name where possible.
    getRecentEmails({ kind: 'list', name: node.name }),
  ])

  return (
    <div>
      <div className="mb-6">
        <Link href="/?type=product" className="text-xs text-[var(--muted)] hover:underline">
          ← Products
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold">{node.name}</h1>
          {node.code && <Chip tone="var(--accent)">{node.code}</Chip>}
        </div>
        {profile.type && <p className="text-[var(--muted)] mt-1">{profile.type}</p>}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {node.publisher && (
            <TagLink href={`/publishers/${slugify(node.publisher)}`}>{node.publisher}</TagLink>
          )}
          {node.gurus.map((g) => (
            <TagLink key={g} href={`/gurus/${slugify(g)}`}>
              {g}
            </TagLink>
          ))}
          {node.topics.slice(0, 8).map((t) => (
            <span key={t} className="text-xs text-[var(--muted)] self-center">
              #{t}
            </span>
          ))}
        </div>
        {node.aliases.length > 0 && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Also promoted as: {node.aliases.join(', ')}
          </p>
        )}
      </div>

      {/* FID USP enrichment */}
      {profile.usps && (
        <Card title="USPs — What This Product Is Really About">
          <Markdown>{profile.usps}</Markdown>
        </Card>
      )}

      {/* Strategy / mechanism summary from the directory */}
      {node.strategies.length > 0 && (
        <Card title="Strategy">
          <div className="flex flex-wrap gap-2">
            {node.strategies.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </Card>
      )}

      {/* Brain product note sections */}
      {profile.found ? (
        profile.sections.map((s, i) => (
          <Card key={i} title={s.heading}>
            <Markdown>{s.body}</Markdown>
          </Card>
        ))
      ) : (
        <Card title="Description">
          <p className="text-sm text-[var(--muted)]">
            No detailed brain note yet for {node.name}. USPs will populate as FID mines its promos.
          </p>
        </Card>
      )}

      <PromoList promos={promos} />
      <RecentEmails data={emails} />
    </div>
  )
}
