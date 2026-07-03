import Link from 'next/link'

export function Card({
  title,
  children,
  right,
}: {
  title?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-5">
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const color = tone || 'var(--muted)'
  return (
    <span
      className="inline-block rounded-full border px-2.5 py-0.5 text-xs"
      style={{ borderColor: 'var(--border)', color }}
    >
      {children}
    </span>
  )
}

export function TagLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
    >
      {children}
    </Link>
  )
}

/** Colour for an effectiveness score 0–10. */
export function scoreTone(score?: number): string {
  if (score == null) return 'var(--muted)'
  if (score >= 7.5) return 'var(--good)'
  if (score >= 5) return 'var(--warn)'
  return 'var(--bad)'
}
