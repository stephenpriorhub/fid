import { Card, Chip, scoreTone } from './ui'
import type { PromoReview } from '@/lib/promos'

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(+d) ? '' : d.toISOString().slice(0, 10)
}

function title(r: PromoReview): string {
  return r.displayName || r.filename.replace(/\.[^.]+$/, '')
}

export default function PromoList({ promos }: { promos: PromoReview[] }) {
  return (
    <Card title={`Promos (${promos.length})`}>
      {promos.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No analyzed promos yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {promos.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-[var(--border)] p-3 bg-[var(--background)]"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="font-medium text-sm">{title(r)}</div>
                <div className="flex items-center gap-2">
                  {r.promoType && <Chip>{r.promoType}</Chip>}
                  {r.promoStatus && <Chip>{r.promoStatus}</Chip>}
                  {r.effectivenessScore != null && (
                    <Chip tone={scoreTone(r.effectivenessScore)}>
                      {r.effectivenessScore.toFixed(1)}/10
                    </Chip>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-[var(--muted)]">
                {fmtDate(r.promoRunStartDate || r.date) && (
                  <span className="tabular-nums">{fmtDate(r.promoRunStartDate || r.date)}</span>
                )}
                {r.product && <span>· {r.product}</span>}
                {r.sections?.stockTease && <span>· Teases: {r.sections.stockTease}</span>}
              </div>
              {r.sections?.effectiveness && (
                <p className="mt-2 text-xs text-[var(--muted)] line-clamp-3">
                  {r.sections.effectiveness.replace(/[#*`]/g, '').slice(0, 300)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
