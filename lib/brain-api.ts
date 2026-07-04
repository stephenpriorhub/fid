import { getEnv } from './env'

/**
 * FID → brain write path. Two strategies, tried in order:
 *   1. Shared Brain API  POST {BRAIN_API_URL}/api/intelligence  { kind: "finpub-enrichment", ... }
 *      (the long-term "librarian" path, same as iSpy / Promo Analyzer — auth: x-hub-token)
 *   2. Direct GitHub Contents API write into a `<!-- finpub:start/end -->` marker block
 *      (fallback until the brain-map API accepts the new kind — needs GITHUB_TOKEN + BRAIN_REPO_URL)
 *
 * Never throws — teaching the brain must never break the product.
 */

export interface WriteResult {
  ok: boolean
  via: 'brain-api' | 'github' | 'none'
  target: string
  bytes: number
  error?: string
}

export interface EnrichmentPayload {
  entityType: 'guru' | 'product'
  entityName: string
  /** Repo-relative path to the note, e.g. "Resources/Experts/Bryan Bottarelli.md". */
  repoPath: string
  /** Markdown to place inside the finpub marker block. */
  markdown: string
  /**
   * Full note content to CREATE when the file doesn't exist yet (self-seed).
   * Must contain empty `<!-- finpub:start/end -->` markers; the markdown is spliced in.
   * Omit to only update existing notes.
   */
  stub?: string
}

const MARKER = 'finpub'
const SECTION_TITLE_GURU = '## FinPub Intel — Bio & Positioning'
const SECTION_TITLE_PRODUCT = '## USPs (FinPub)'

function brainApiUrl(): string {
  return (getEnv('BRAIN_API_URL') || 'https://brain.oxfordhub.app').replace(/\/$/, '')
}

/** Try the shared Brain API first. */
async function viaBrainApi(p: EnrichmentPayload): Promise<WriteResult | null> {
  const token = getEnv('HUB_API_TOKEN')
  if (!token) return null
  try {
    const res = await fetch(`${brainApiUrl()}/api/intelligence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-token': token },
      body: JSON.stringify({
        kind: 'finpub-enrichment',
        entityType: p.entityType,
        entityName: p.entityName,
        repoPath: p.repoPath,
        marker: MARKER,
        markdown: p.markdown,
        stub: p.stub,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    // Any non-success (404, "Unknown kind: finpub-enrichment" until brain-map adds
    // the handler, auth failure, transient 5xx) → fall through to the GitHub write
    // so the enrichment still lands. Only a real success short-circuits.
    if (!res.ok || json.ok === false) {
      console.warn(`[brain-api] finpub-enrichment not persisted (${res.status}: ${json.error || 'error'}) — falling back to GitHub`)
      return null
    }
    return { ok: true, via: 'brain-api', target: p.repoPath, bytes: p.markdown.length }
  } catch {
    return null // network error → try github fallback
  }
}

function parseRepo(): { owner: string; repo: string } | null {
  const url = getEnv('BRAIN_REPO_URL')
  if (!url) return null
  const m =
    /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/.exec(url) ||
    /^([^/]+)\/([^/.]+)$/.exec(url)
  return m ? { owner: m[1], repo: m[2] } : null
}

/** Insert or replace the finpub marker block inside the note content. */
export function spliceMarkerBlock(content: string, markdown: string, sectionTitle: string): string {
  const block = `<!-- ${MARKER}:start -->\n${markdown.trim()}\n<!-- ${MARKER}:end -->`
  const re = new RegExp(`<!--\\s*${MARKER}:start\\s*-->[\\s\\S]*?<!--\\s*${MARKER}:end\\s*-->`, 'i')
  if (re.test(content)) return content.replace(re, block)
  const sep = content.endsWith('\n') ? '\n' : '\n\n'
  return `${content}${sep}${sectionTitle}\n${block}\n`
}

async function viaGithub(p: EnrichmentPayload): Promise<WriteResult> {
  const token = getEnv('GITHUB_TOKEN')
  const repo = parseRepo()
  if (!token || !repo) {
    return { ok: false, via: 'none', target: p.repoPath, bytes: 0, error: 'no Brain API and no GITHUB_TOKEN/BRAIN_REPO_URL' }
  }
  const api = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${p.repoPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'fid-enrichment',
  }
  const title = p.entityType === 'product' ? SECTION_TITLE_PRODUCT : SECTION_TITLE_GURU
  try {
    const getRes = await fetch(api, { headers, cache: 'no-store' })
    let current: string
    let sha: string | undefined
    if (getRes.ok) {
      const file = (await getRes.json()) as { sha: string; content: string; encoding: string }
      current = Buffer.from(file.content, file.encoding as BufferEncoding).toString('utf8')
      sha = file.sha
    } else if (getRes.status === 404 && p.stub) {
      current = p.stub // self-seed a new note
    } else {
      return { ok: false, via: 'github', target: p.repoPath, bytes: 0, error: `GET ${getRes.status}` }
    }
    const updated = spliceMarkerBlock(current, p.markdown, title)
    if (sha && updated === current) {
      return { ok: true, via: 'github', target: p.repoPath, bytes: 0 } // no-op
    }
    const putRes = await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: sha ? `FID enrichment: ${p.entityName}` : `FID: seed + enrich ${p.entityName}`,
        content: Buffer.from(updated, 'utf8').toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    })
    if (!putRes.ok) {
      const err = (await putRes.json().catch(() => ({}))) as { message?: string }
      return { ok: false, via: 'github', target: p.repoPath, bytes: 0, error: err.message || `PUT ${putRes.status}` }
    }
    return { ok: true, via: 'github', target: p.repoPath, bytes: p.markdown.length }
  } catch (e) {
    return {
      ok: false,
      via: 'github',
      target: p.repoPath,
      bytes: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function writeEnrichment(p: EnrichmentPayload): Promise<WriteResult> {
  const viaApi = await viaBrainApi(p)
  if (viaApi) return viaApi
  return viaGithub(p)
}
