import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findGuruBySlug, getGraph } from '@/lib/directory'
import { getGuruProfile } from '@/lib/gurus'
import { getPromosForGuru } from '@/lib/promos'
import { getRecentEmails } from '@/lib/ispy'
import { slugify } from '@/lib/slug'
import Markdown from '@/components/Markdown'
import PromoList from '@/components/PromoList'
import RecentEmails from '@/components/RecentEmails'
import { Card, TagLink } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function GuruPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const node = await findGuruBySlug(slug)
  if (!node) notFound()

  const [profile, promos, emails, graph] = await Promise.all([
    Promise.resolve(getGuruProfile(node.name)),
    getPromosForGuru(node.name),
    getRecentEmails({ kind: 'guru', name: node.name }),
    getGraph(),
  ])

  const products = graph.products.filter((p) => node.products.includes(p.name))

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/?type=guru" className="text-xs text-[var(--muted)] hover:underline">
          ← Gurus
        </Link>
        <h1 className="text-2xl font-bold mt-2">{node.name}</h1>
        {profile.role && <p className="text-[var(--muted)] mt-1">{profile.role}</p>}
        {profile.nickname && (
          <p className="text-sm text-[var(--accent)] italic mt-0.5">“{profile.nickname}”</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {node.publishers.map((p) => (
            <TagLink key={p} href={`/publishers/${slugify(p)}`}>
              {p}
            </TagLink>
          ))}
          {node.topics.slice(0, 8).map((t) => (
            <span key={t} className="text-xs text-[var(--muted)] self-center">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* FID enrichment (bio & positioning) */}
      {profile.finpub && (
        <Card title="FID Intel — Bio & Positioning">
          <Markdown>{profile.finpub}</Markdown>
        </Card>
      )}

      {/* Currently talking about (iSpy) */}
      {profile.ispy && (
        <Card title="Currently Talking About">
          <Markdown>{profile.ispy}</Markdown>
        </Card>
      )}

      {/* Products */}
      {products.length > 0 && (
        <Card title="Products">
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <TagLink key={p.slug} href={`/products/${p.slug}`}>
                {p.name}
                {p.code ? ` (${p.code})` : ''}
              </TagLink>
            ))}
          </div>
        </Card>
      )}

      {/* Bio + strategy sections from the brain (claims excluded). The verbose
          "Products" prose section is dropped — the linked Products list above
          replaces it. */}
      {profile.found ? (
        profile.sections.map((s, i) => (
          <Card key={i} title={s.heading}>
            <Markdown>{s.body}</Markdown>
          </Card>
        ))
      ) : (
        <Card title="Profile">
          <p className="text-sm text-[var(--muted)]">
            No detailed brain profile yet for {node.name}. Directory data and live intelligence
            below.
          </p>
        </Card>
      )}

      <PromoList promos={promos} />
      <RecentEmails data={emails} />
    </div>
  )
}
