import { Card, Chip, scoreTone } from './ui'
import { promoAppUrl, getPerformanceByReview, type PromoReview } from '@/lib/promos'

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(+d) ? '' : d.toISOString().slice(0, 10)
}

function title(r: PromoReview): string {
  return r.displayName || r.filename.replace(/\.[^.]+$/, '')
}

export default async function PromoList({ promos }: { promos: PromoReview[] }) {
  const base = promoAppUrl()
  const perf = await getPerformanceByReview()

  return (
    <Card title={`Promos (${promos.length})`}>
      {promos.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No analyzed promos yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {promos.map((r) => {
            const date = fmtDate(r.promoRunStartDate || r.date)
            const copy = r.effectivenessScore
            const real = r.training?.performanceScore
            const p = perf[r.id]
            return (
              <li key={r.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{title(r)}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-[var(--muted)]">
                    {date && <span className="tabular-nums">{date}</span>}
                    {r.promoType && <Chip>{r.promoType}</Chip>}
                    {copy != null && (
                      <Chip tone={scoreTone(copy)}>Copy {copy.toFixed(1)}/10</Chip>
                    )}
                    {real != null && (
                      <Chip tone={scoreTone(real)}>Real-world {real.toFixed(1)}/10</Chip>
                    )}
                    {p?.orders && <Chip>Orders {p.orders}</Chip>}
                    {p?.revenue && <Chip>Revenue {p.revenue}</Chip>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {base && r.sourceFile && (
                    <a
                      href={`${base}/api/files/${r.id}/source`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      Download promo
                    </a>
                  )}
                  {base && (
                    <a
                      href={`${base}/?review=${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-[var(--accent)] text-black font-medium px-3 py-1.5 text-xs hover:opacity-90 transition-opacity"
                    >
                      View analysis
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
