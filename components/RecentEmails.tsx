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
            <li key={e.id} className="py-2.5 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--muted)] tabular-nums">
                  {fmtDate(e.receivedAt)}
                </span>
                {e.emailType && <Chip>{e.emailType}</Chip>}
                {e.list?.name && <Chip>{e.list.name}</Chip>}
              </div>
              <div className="text-sm font-medium">{e.subject}</div>
              {e.aiSummary && (
                <div className="text-xs text-[var(--muted)] line-clamp-2">{e.aiSummary}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
