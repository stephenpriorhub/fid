import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getKnowledgeGraphPath, getResourcesBase } from './vault'
import { extractMarkerBlock } from './markdown'

export interface PublisherContext {
  /** Top-level family the publisher belongs to (Agora / MarketWise / independent…). */
  family?: string
  /** A one-line description pulled from the Knowledge Graph, if present. */
  note?: string
  /** FID-generated house-level intelligence brief (from the publisher note's finpub block). */
  houseBrief?: string | null
}

/** Cheap heuristic: parent-company cells encode family in parens, e.g. "Paradigm Press (Agora)". */
function familyFromName(name: string): string | undefined {
  const m = /\(([^)]+)\)/.exec(name)
  if (m) {
    const inner = m[1]
    if (/agora/i.test(inner)) return 'Agora'
    if (/marketwise/i.test(inner)) return 'MarketWise'
    return inner
  }
  if (/marketwise/i.test(name)) return 'MarketWise'
  if (/oxford|paradigm|banyan|money map|trendlabs|manward/i.test(name)) return 'Agora'
  if (/stansberry|investorplace|brownstone|palm beach|legacy research/i.test(name))
    return 'MarketWise'
  return undefined
}

export function getPublisherContext(name: string): PublisherContext {
  const family = familyFromName(name)
  let note: string | undefined
  let houseBrief: string | null = null

  const notePath = join(getResourcesBase(), 'Publishers', `${name}.md`)
  if (existsSync(notePath)) {
    try {
      houseBrief = extractMarkerBlock(readFileSync(notePath, 'utf8'), 'finpub')
    } catch {
      /* ignore */
    }
  }
  const kg = getKnowledgeGraphPath()
  if (existsSync(kg)) {
    try {
      const md = readFileSync(kg, 'utf8')
      const line = md
        .split('\n')
        .find((l) => l.toLowerCase().includes(name.toLowerCase().replace(/\s*\(.*\)$/, '')))
      if (line) note = line.replace(/^[\s#>*|-]+/, '').trim().slice(0, 240)
    } catch {
      /* ignore */
    }
  }
  return { family, note, houseBrief }
}
