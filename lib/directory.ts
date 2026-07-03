import { readFileSync, existsSync } from 'fs'
import { getDirectoryPath } from './vault'
import { slugify } from './slug'
import { stripWikilinks } from './markdown'

export interface DirectoryRow {
  gurus: string[] // one row can be co-authored ("A + B")
  publicationRaw: string
  productName: string // canonical (aliases collapsed)
  productCode?: string
  isAlias: boolean
  publisher: string
  strategies: string[]
  topics: string[]
  confidence: 'confirmed' | 'inferred' | string
}

export interface GuruNode {
  name: string
  slug: string
  publishers: string[]
  products: string[] // canonical product names
  strategies: string[]
  topics: string[]
}

export interface ProductNode {
  name: string
  slug: string
  code?: string
  publisher: string
  gurus: string[]
  strategies: string[]
  topics: string[]
  aliases: string[]
}

export interface PublisherNode {
  name: string
  slug: string
  gurus: string[]
  products: string[]
}

export interface EntityGraph {
  gurus: GuruNode[]
  products: ProductNode[]
  publishers: PublisherNode[]
  rows: DirectoryRow[]
}

const CODE_RE = /^[A-Z][A-Za-z0-9]{0,7}$/ // short uppercase code like WAR, TPU, PMK, MTLIV

function splitList(cell: string): string[] {
  return cell
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseGuruCell(cell: string): string[] {
  return stripWikilinks(cell)
    .split(/\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Parse a "Publication" cell into a canonical product name, code, and alias flag. */
function parsePublication(
  publicationRaw: string,
  confidence: string
): { name: string; code?: string; isAlias: boolean } {
  const raw = stripWikilinks(publicationRaw).trim()
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(raw)
  const aliasSignal = /alias|former name/i.test(confidence)

  if (m) {
    const before = m[1].trim()
    const inParens = m[2].trim()
    if (CODE_RE.test(inParens)) {
      // "The War Room (WAR)" → name + code
      return { name: before, code: inParens, isAlias: false }
    }
    // "Trade of the Day Plus (Monument Trend Advisory)" → canonical name is in parens
    if (aliasSignal || /[a-z]/.test(inParens)) {
      // pull a code from the canonical name if it also carries one
      const inner = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(inParens)
      if (inner && CODE_RE.test(inner[2].trim())) {
        return { name: inner[1].trim(), code: inner[2].trim(), isAlias: true }
      }
      return { name: inParens, isAlias: true }
    }
    return { name: before, code: inParens, isAlias: false }
  }
  return { name: raw, isAlias: aliasSignal }
}

export function parseDirectoryRows(md: string): DirectoryRow[] {
  const rows: DirectoryRow[] = []
  for (const line of md.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    // Leading/trailing empty cells from the surrounding pipes.
    const cols = cells.slice(1, -1)
    if (cols.length < 6) continue
    const [guru, publication, parent, strategies, topics, confidence] = cols
    // Skip the header + separator rows.
    if (/^guru$/i.test(guru) || /^-+$/.test(guru.replace(/[:\s]/g, ''))) continue
    if (!guru || !publication || !parent) continue

    const { name, code, isAlias } = parsePublication(publication, confidence)
    rows.push({
      gurus: parseGuruCell(guru),
      publicationRaw: stripWikilinks(publication),
      productName: name,
      productCode: code,
      isAlias,
      publisher: stripWikilinks(parent),
      strategies: splitList(strategies),
      topics: splitList(topics),
      confidence: (confidence.split(/[\s(]/)[0] || confidence).toLowerCase(),
    })
  }
  return rows
}

function push(map: Map<string, Set<string>>, key: string, ...vals: string[]) {
  if (!map.has(key)) map.set(key, new Set())
  for (const v of vals) if (v) map.get(key)!.add(v)
}

export function buildGraph(rows: DirectoryRow[]): EntityGraph {
  const guruPubs = new Map<string, Set<string>>()
  const guruProds = new Map<string, Set<string>>()
  const guruStrat = new Map<string, Set<string>>()
  const guruTopics = new Map<string, Set<string>>()

  const prodGurus = new Map<string, Set<string>>()
  const prodStrat = new Map<string, Set<string>>()
  const prodTopics = new Map<string, Set<string>>()
  const prodAliases = new Map<string, Set<string>>()
  const prodPublisher = new Map<string, string>()

  const pubGurus = new Map<string, Set<string>>()
  const pubProds = new Map<string, Set<string>>()

  for (const r of rows) {
    for (const g of r.gurus) {
      push(guruPubs, g, r.publisher)
      push(guruProds, g, r.productName)
      push(guruStrat, g, ...r.strategies)
      push(guruTopics, g, ...r.topics)
      push(pubGurus, r.publisher, g)
      push(prodGurus, r.productName, g)
    }
    push(prodStrat, r.productName, ...r.strategies)
    push(prodTopics, r.productName, ...r.topics)
    push(pubProds, r.publisher, r.productName)
    // The canonical product keeps the first publisher we see (rows are consistent per product).
    if (!prodPublisher.has(r.productName)) prodPublisher.set(r.productName, r.publisher)
    if (r.isAlias && r.publicationRaw && r.publicationRaw !== r.productName) {
      push(prodAliases, r.productName, r.publicationRaw)
    }
  }

  const gurus: GuruNode[] = [...guruPubs.keys()].sort().map((name) => ({
    name,
    slug: slugify(name),
    publishers: [...(guruPubs.get(name) || [])],
    products: [...(guruProds.get(name) || [])],
    strategies: [...(guruStrat.get(name) || [])],
    topics: [...(guruTopics.get(name) || [])],
  }))

  const products: ProductNode[] = [...prodGurus.keys()].sort().map((name) => {
    const codeRow = rows.find((r) => r.productName === name && r.productCode)
    return {
      name,
      slug: slugify(name),
      code: codeRow?.productCode,
      publisher: prodPublisher.get(name) || '',
      gurus: [...(prodGurus.get(name) || [])],
      strategies: [...(prodStrat.get(name) || [])],
      topics: [...(prodTopics.get(name) || [])],
      aliases: [...(prodAliases.get(name) || [])],
    }
  })

  const publishers: PublisherNode[] = [...pubGurus.keys()].sort().map((name) => ({
    name,
    slug: slugify(name),
    gurus: [...(pubGurus.get(name) || [])],
    products: [...(pubProds.get(name) || [])],
  }))

  return { gurus, products, publishers, rows }
}

/** Load + parse the directory fresh each call (cheap; keeps pages current after a vault pull). */
export function getGraph(): EntityGraph {
  const path = getDirectoryPath()
  if (!existsSync(path)) return { gurus: [], products: [], publishers: [], rows: [] }
  const md = readFileSync(path, 'utf8')
  return buildGraph(parseDirectoryRows(md))
}

export function findGuruBySlug(slug: string): GuruNode | undefined {
  return getGraph().gurus.find((g) => g.slug === slug)
}
export function findProductBySlug(slug: string): ProductNode | undefined {
  return getGraph().products.find((p) => p.slug === slug)
}
export function findPublisherBySlug(slug: string): PublisherNode | undefined {
  return getGraph().publishers.find((p) => p.slug === slug)
}
