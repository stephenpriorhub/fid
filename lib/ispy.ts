import { getEnv } from './env'

/**
 * iSpy Emails client. Reads live from the iSpy app's public API and builds deep
 * links into iSpy's filtered email-search UI. Never throws — returns empty data
 * on any failure so a page always renders.
 */

const REVALIDATE = 300 // 5 min

export interface IspyEmail {
  id: string
  /** Deep link to the full email in iSpy (/emails/:id). */
  url?: string
  subject: string
  fromName?: string | null
  fromEmail: string
  receivedAt: string
  inboxPlacement?: string
  emailType?: string
  aiSummary?: string | null
  aiTicker?: string | null
  publisher?: { id: string; name: string } | null
  list?: { id: string; name: string } | null
  gurus?: { guru: { id: string; name: string } }[]
  offer?: { url?: string | null; promise?: string | null } | null
}

interface NamedEntity {
  id: string
  name: string
}

function apiUrl(): string | undefined {
  return getEnv('ISPY_API_URL')?.replace(/\/$/, '')
}
function appUrl(): string {
  return (getEnv('ISPY_APP_URL') || getEnv('ISPY_API_URL') || '').replace(/\/$/, '')
}
function authHeaders(): Record<string, string> {
  // If iSpy's API sits behind the same OxfordHub auth wall, admit via the shared
  // service token; harmless if iSpy doesn't gate reads.
  const token = getEnv('HUB_API_TOKEN')
  return token ? { 'x-hub-token': token } : {}
}

async function getJson<T>(path: string): Promise<T | null> {
  const base = apiUrl()
  if (!base) return null
  try {
    const res = await fetch(`${base}${path}`, {
      headers: authHeaders(),
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function findByName(list: NamedEntity[] | null, name: string): NamedEntity | undefined {
  if (!list) return undefined
  const n = name.trim().toLowerCase()
  return list.find((e) => e.name?.trim().toLowerCase() === n)
}

export type IspyFilter =
  | { kind: 'guru'; name: string }
  | { kind: 'publisher'; name: string }
  | { kind: 'list'; name: string }

async function resolveId(filter: IspyFilter): Promise<string | undefined> {
  if (filter.kind === 'guru') {
    const gurus = await getJson<NamedEntity[]>('/api/gurus')
    return findByName(gurus, filter.name)?.id
  }
  if (filter.kind === 'publisher') {
    const pubs = await getJson<NamedEntity[]>('/api/publishers')
    return findByName(pubs, filter.name)?.id
  }
  const lists = await getJson<NamedEntity[]>('/api/lists')
  return findByName(lists, filter.name)?.id
}

export interface RecentEmailsResult {
  emails: IspyEmail[]
  total: number
  /** Deep link into iSpy's filtered email-search UI (or null if unresolved). */
  viewAllUrl: string | null
}

/** Fetch the most recent N emails for a guru / publisher / list, plus a "view all" deep link. */
export async function getRecentEmails(
  filter: IspyFilter,
  limit = 8
): Promise<RecentEmailsResult> {
  const id = await resolveId(filter)
  if (!id) return { emails: [], total: 0, viewAllUrl: null }

  const param = filter.kind // guru | publisher | list — matches iSpy /emails query keys
  // iSpy's guru filter expands to a guru's "secondary voices", which pulls in
  // house-wide emails that don't actually feature the guru. Over-fetch and
  // strict-filter to emails genuinely tagged with this guru so the profile only
  // shows their own emails. (publisher/list filters are already precise.)
  const fetchLimit = filter.kind === 'guru' ? Math.min(limit * 6, 60) : limit
  const data = await getJson<{ emails: IspyEmail[]; total: number }>(
    `/api/emails?${param}=${encodeURIComponent(id)}&limit=${fetchLimit}&sort=receivedAt&order=desc`
  )
  let emails = data?.emails ?? []
  let total = data?.total ?? 0

  if (filter.kind === 'guru') {
    const n = filter.name.trim().toLowerCase()
    const strict = emails.filter((e) =>
      (e.gurus ?? []).some((g) => g.guru?.name?.trim().toLowerCase() === n)
    )
    // Guard against a name-format mismatch wiping everything.
    if (strict.length > 0 || emails.length === 0) {
      total = strict.length
      emails = strict
    }
  }

  const base = appUrl()
  const viewAllUrl = base ? `${base}/emails?${param}=${encodeURIComponent(id)}` : null
  return {
    emails: emails.slice(0, limit).map((e) => ({
      ...e,
      url: base ? `${base}/emails/${e.id}` : undefined,
    })),
    total,
    viewAllUrl,
  }
}
