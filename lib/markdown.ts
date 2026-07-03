import matter from 'gray-matter'

export interface Section {
  heading: string
  level: number
  /** Body markdown under this heading, excluding the heading line itself. */
  body: string
}

export interface ParsedDoc {
  frontmatter: Record<string, unknown>
  /** Content before the first heading. */
  intro: string
  sections: Section[]
  /** Raw markdown body (frontmatter stripped). */
  raw: string
}

/**
 * Headings whose entire section (and any deeper subsections beneath it) must be
 * dropped when rendering a guru/product page. Enforces "no track record / claims"
 * and hides internal-only housekeeping sections.
 */
const CLAIMS_HEADING = /^(track record\b|historical published calls|verified claims|claims\b)/i
// Internal/housekeeping or separately-rendered sections we never show inline.
const HOUSEKEEPING_HEADING =
  /^(assets|todo|to-?do|log|changelog|ispy\b|ispy —|finpub intel|usps \(finpub\))/i

/** HTML-comment owner blocks that must be stripped wholesale (e.g. claims-integrity). */
const CLAIMS_OWNER_BLOCK =
  /<!--\s*owner:claims-integrity\s*-->[\s\S]*?<!--\s*\/owner:claims-integrity\s*-->/gi

/** Lines that reference Airtable (claims/testimonials bases or embeds). */
const AIRTABLE_LINE = /airtable/i

export function isClaimsHeading(heading: string): boolean {
  const h = heading.trim()
  return CLAIMS_HEADING.test(h) || HOUSEKEEPING_HEADING.test(h)
}

/** Parse a markdown document into frontmatter + intro + `##`/`###` sections. */
export function parseDoc(source: string): ParsedDoc {
  const { data, content } = matter(source)
  const lines = content.split('\n')
  const sections: Section[] = []
  let intro: string[] = []
  let current: Section | null = null

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      if (current) sections.push(current)
      current = { level: m[1].length, heading: m[2].trim(), body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else {
      intro.push(line)
    }
  }
  if (current) sections.push(current)

  return {
    frontmatter: data,
    intro: intro.join('\n').trim(),
    sections,
    raw: content,
  }
}

/**
 * Return sections with claims/track-record + housekeeping sections removed and
 * Airtable references scrubbed. When an H2 is dropped, every deeper subsection
 * (H3+) beneath it is dropped too — the parser flattens hierarchy, so we track
 * the excluded level and skip until a heading of equal-or-higher rank appears.
 */
export function stripClaims(sections: Section[]): Section[] {
  const out: Section[] = []
  let dropDeeperThan: number | null = null
  for (const s of sections) {
    if (dropDeeperThan !== null) {
      if (s.level > dropDeeperThan) continue // still inside the excluded block
      dropDeeperThan = null // rank returned to the excluded heading's level or higher
    }
    if (isClaimsHeading(s.heading)) {
      dropDeeperThan = s.level
      continue
    }
    out.push({
      ...s,
      body: s.body
        .replace(CLAIMS_OWNER_BLOCK, '')
        .split('\n')
        .filter((l) => !AIRTABLE_LINE.test(l))
        .join('\n')
        .trim(),
    })
  }
  return out
}

/** Find the first section whose heading matches (case-insensitive substring). */
export function findSection(sections: Section[], needle: string): Section | undefined {
  const n = needle.toLowerCase()
  return sections.find((s) => s.heading.toLowerCase().includes(n))
}

/** Extract the content inside a paired HTML-comment marker block, e.g. iSpy or finpub. */
export function extractMarkerBlock(source: string, marker: string): string | null {
  const re = new RegExp(
    `<!--\\s*${marker}:start\\s*-->([\\s\\S]*?)<!--\\s*${marker}:end\\s*-->`,
    'i'
  )
  const m = re.exec(source)
  return m ? m[1].trim() : null
}

/** Strip Obsidian wikilinks: [[Target|Label]] → Label, [[Target]] → Target. */
export function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
}
