'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface EntityItem {
  type: 'guru' | 'product' | 'publisher'
  name: string
  slug: string
  sub?: string // publisher / parent / family
  code?: string
  topics: string[]
}

const TABS: { key: EntityItem['type'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'guru', label: 'Gurus' },
  { key: 'product', label: 'Products' },
  { key: 'publisher', label: 'Publishers' },
]

const HREF: Record<EntityItem['type'], string> = {
  guru: '/gurus',
  product: '/products',
  publisher: '/publishers',
}

export default function DirectoryBrowser({
  items,
  initialType = 'all',
}: {
  items: EntityItem[]
  initialType?: EntityItem['type'] | 'all'
}) {
  const [type, setType] = useState<EntityItem['type'] | 'all'>(initialType)
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('')

  const topics = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => i.topics.forEach((t) => s.add(t)))
    return [...s].sort()
  }, [items])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((i) => {
      if (type !== 'all' && i.type !== type) return false
      if (topic && !i.topics.includes(topic)) return false
      if (needle) {
        const hay = `${i.name} ${i.sub || ''} ${i.code || ''} ${i.topics.join(' ')}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [items, type, q, topic])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`px-3 py-1.5 text-sm ${
                type === t.key
                  ? 'bg-[var(--accent)] text-black font-medium'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search gurus, products, publishers, topics…"
          className="flex-1 min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-[var(--muted)] mb-3">{filtered.length} results</div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((i) => (
          <Link
            key={`${i.type}:${i.slug}`}
            href={`${HREF[i.type]}/${i.slug}`}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                {i.type}
              </span>
              {i.code && <span className="text-[10px] text-[var(--accent)]">{i.code}</span>}
            </div>
            <div className="font-semibold mt-1">{i.name}</div>
            {i.sub && <div className="text-xs text-[var(--muted)] mt-0.5">{i.sub}</div>}
            {i.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {i.topics.slice(0, 4).map((t) => (
                  <span key={t} className="text-[10px] text-[var(--muted)]">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
