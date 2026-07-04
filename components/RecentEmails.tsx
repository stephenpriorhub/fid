import { Card, Chip } from './ui'
import type { RecentEmailsResult } from '@/lib/ispy'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(+d) ? '' : d.toISOString().slice(0, 10)
}

export default function RecentEmails({ data }: { data: RecentEmailsResult }) {
  const { emails, total, viewAllUrl } = data
  return (
    <Card
      title="Recent Emails"
      right={
        viewAllUrl ? (
          <a
            href={viewAllUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--accent-2)] hover:underline"
          >
            View all{total ? ` (${total})` : ''} in iSpy →
          </a>
        ) : null
      }
    >
      {emails.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No emails captured yet{viewAllUrl ? '' : ' (iSpy not connected)'}.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {emails.map((e) => (
            <li key={e.id} className="py-2.5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--muted)] tabular-nums">
                    {fmtDate(e.receivedAt)}
                  </span>
                  {e.emailType && <Chip>{e.emailType}</Chip>}
                  {e.list?.name && <Chip>{e.list.name}</Chip>}
                </div>
                <div className="text-sm font-medium mt-0.5">{e.subject}</div>
                {e.aiSummary && (
                  <div className="text-xs text-[var(--muted)] line-clamp-2 mt-0.5">
                    {e.aiSummary}
                  </div>
                )}
              </div>
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  Read full email
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
