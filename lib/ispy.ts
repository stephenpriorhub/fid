import { getEnv } from './env'

/**
 * iSpy Emails client. Reads live from the iSpy app's public API and builds deep
 * links into iSpy's filtered email-search UI. Never throws — returns empty data
 * on any failure so a page always renders.
 */

const REVALIDATE = 300 // 5 min

export interface IspyEmail {
  id: string
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
  const token = getEnv('ISPY_API_TOKEN')
  return token ? { authorization: `Bearer ${token}` } : {}
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
  const data = await getJson<{ emails: IspyEmail[]; total: number }>(
    `/api/emails?${param}=${encodeURIComponent(id)}&limit=${limit}&sort=receivedAt&order=desc`
  )
  const base = appUrl()
  const viewAllUrl = base ? `${base}/emails?${param}=${encodeURIComponent(id)}` : null
  return {
    emails: data?.emails ?? [],
    total: data?.total ?? 0,
    viewAllUrl,
  }
}
