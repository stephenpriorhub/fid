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

interface GuruEntity extends NamedEntity {
  lists?: { list?: { id: string; name: string } }[]
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
  const base = appUrl()
  const withUrl = (e: IspyEmail) => ({ ...e, url: base ? `${base}/emails/${e.id}` : undefined })

  if (filter.kind === 'guru') {
    // iSpy tags an email with every guru MENTIONED in it, so a guru's raw feed is
    // full of noise — roundups, house ads, and promos about OTHER gurus that merely
    // name-drop them. Shared house lists (Trade of the Day, etc.) carry every MTA
    // guru, so list membership is too broad. Keep an email only if it's genuinely
    // the guru's: FROM them, SOLELY about them (they're the only tagged guru), or
    // their name is in the subject line. A bare mention is dropped.
    const gurus = (await getJson<GuruEntity[]>('/api/gurus')) ?? []
    const nname = filter.name.trim().toLowerCase()
    const g = gurus.find((x) => x.name?.trim().toLowerCase() === nname)
    if (!g) return { emails: [], total: 0, viewAllUrl: null }

    const last = nname.split(/\s+/).pop() || nname
    const mentions = (s?: string | null) => {
      const x = (s ?? '').toLowerCase()
      return x.includes(nname) || (last.length > 3 && x.includes(last))
    }
    const data = await getJson<{ emails: IspyEmail[]; total: number }>(
      `/api/emails?guru=${encodeURIComponent(g.id)}&limit=60&sort=receivedAt&order=desc`
    )
    const relevant = (data?.emails ?? []).filter((e) => {
      const fromThem = mentions(`${e.fromName ?? ''} ${e.fromEmail ?? ''}`)
      const tagged = e.gurus ?? []
      const soleSubject =
        tagged.length === 1 && tagged[0].guru?.name?.trim().toLowerCase() === nname
      const namedInSubject = mentions(e.subject)
      return fromThem || soleSubject || namedInSubject
    })
    const viewAllUrl = base ? `${base}/emails?guru=${encodeURIComponent(g.id)}` : null
    return { emails: relevant.slice(0, limit).map(withUrl), total: relevant.length, viewAllUrl }
  }

  // publisher / list filters are already precise in iSpy.
  const id = await resolveId(filter)
  if (!id) return { emails: [], total: 0, viewAllUrl: null }
  const param = filter.kind
  const data = await getJson<{ emails: IspyEmail[]; total: number }>(
    `/api/emails?${param}=${encodeURIComponent(id)}&limit=${limit}&sort=receivedAt&order=desc`
  )
  const viewAllUrl = base ? `${base}/emails?${param}=${encodeURIComponent(id)}` : null
  return {
    emails: (data?.emails ?? []).map(withUrl),
    total: data?.total ?? 0,
    viewAllUrl,
  }
}
