import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getPublicationsBase } from './vault'
import { slugify } from './slug'
import { parseDoc, extractMarkerBlock, stripWikilinks, type Section } from './markdown'

export interface ProductProfile {
  found: boolean
  name: string
  guru?: string
  parentCompany?: string
  type?: string
  /** Description + mechanism + topics + offer sections, in order. */
  sections: Section[]
  /** FID's own USP enrichment block, if written. */
  usps: string | null
  sourcePath?: string
}

function resolveFile(name: string, code?: string): string | undefined {
  const dir = getPublicationsBase()
  if (!existsSync(dir)) return undefined
  const target = slugify(name)
  const codeTarget = code ? slugify(code) : undefined
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  for (const f of files) {
    const base = slugify(f.replace(/\.md$/, ''))
    if (base === target) return join(dir, f)
  }
  // Fuzzy: filename contains the product name or code.
  for (const f of files) {
    const base = slugify(f.replace(/\.md$/, ''))
    if (base.includes(target) || target.includes(base)) return join(dir, f)
    if (codeTarget && base.includes(codeTarget)) return join(dir, f)
  }
  return undefined
}

function firstMatch(re: RegExp, text: string): string | undefined {
  const m = re.exec(text)
  return m ? stripWikilinks(m[1]).trim() : undefined
}

export function getProductProfile(name: string, code?: string): ProductProfile {
  const path = resolveFile(name, code)
  if (!path || !existsSync(path)) {
    return { found: false, name, sections: [], usps: null }
  }
  const source = readFileSync(path, 'utf8')
  const doc = parseDoc(source)
  const head = doc.intro

  return {
    found: true,
    name,
    guru: firstMatch(/\*\*Guru:?\*\*:?\s*(.+)/i, head),
    parentCompany: firstMatch(/\*\*Parent Company:?\*\*:?\s*(.+)/i, head),
    type: firstMatch(/\*\*Type:?\*\*:?\s*(.+)/i, head),
    sections: doc.sections.filter((s) => s.body.trim().length > 0),
    usps: extractMarkerBlock(source, 'finpub'),
    sourcePath: path,
  }
}
