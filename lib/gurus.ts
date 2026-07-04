import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getExpertsBase, getCompetitorsBase } from './vault'
import { slugify } from './slug'
import {
  parseDoc,
  stripClaims,
  dropSectionTree,
  extractMarkerBlock,
  stripWikilinks,
  type Section,
} from './markdown'

export interface GuruProfile {
  found: boolean
  name: string
  role?: string
  nickname?: string
  publisher?: string
  headshot?: string
  /** Non-claims sections, in document order. */
  sections: Section[]
  /** Live "currently talking about" content from the iSpy Brain Agent block. */
  ispy: string | null
  /** FID's own enrichment block (bio & positioning), if written. */
  finpub: string | null
  sourcePath?: string
}

interface FileEntry {
  path: string
  fileSlug: string
  h1Slug: string | null
}

function listProfileFiles(): FileEntry[] {
  const dirs = [getExpertsBase(), getCompetitorsBase()]
  const out: FileEntry[] = []
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue
      const path = join(dir, f)
      const base = f.replace(/\.md$/, '')
      // Competitor files are often "Name - Publisher.md" — key on the name part too.
      const namePart = base.split(' - ')[0]
      let h1Slug: string | null = null
      try {
        const first = readFileSync(path, 'utf8')
        const m = /^#\s+(.+)$/m.exec(first)
        if (m) h1Slug = slugify(m[1])
      } catch {
        /* ignore */
      }
      out.push({ path, fileSlug: slugify(namePart), h1Slug })
    }
  }
  return out
}

function resolveFile(name: string): string | undefined {
  const target = slugify(name)
  const files = listProfileFiles()
  const hit =
    files.find((f) => f.h1Slug === target) ||
    files.find((f) => f.fileSlug === target) ||
    files.find((f) => f.fileSlug.startsWith(target) || target.startsWith(f.fileSlug))
  return hit?.path
}

function firstMatch(re: RegExp, text: string): string | undefined {
  const m = re.exec(text)
  return m ? m[1].trim() : undefined
}

export function getGuruProfile(name: string): GuruProfile {
  const path = resolveFile(name)
  if (!path || !existsSync(path)) {
    return { found: false, name, sections: [], ispy: null, finpub: null }
  }
  const source = readFileSync(path, 'utf8')
  const doc = parseDoc(source)
  const intro = doc.intro

  const role = firstMatch(/\*\*Role\*\*:\s*(.+)/i, intro)
  const nickname = firstMatch(/\*\*Nickname\*\*:\s*["“]?([^"”\n]+)["”]?/i, intro)
  const publisherRaw = role ? role.split('·')[1] : undefined
  const publisher = publisherRaw ? stripWikilinks(publisherRaw).trim() : undefined

  const headshot = firstMatch(/Headshot:\s*`([^`]+)`/i, source)

  // Drop the verbose "Products" tree (parent + Backends/Frontend/etc. subsections)
  // BEFORE the empty-body filter — the "## Products" H2 often has no direct body,
  // so filtering empties first would strip the anchor and leave its children behind.
  // The guru page renders a clean linked product list instead.
  const sections = dropSectionTree(stripClaims(doc.sections), (s) =>
    /^products$/i.test(s.heading.trim())
  ).filter((s) => s.body.trim().length > 0)

  return {
    found: true,
    name,
    role: role ? stripWikilinks(role.split('·')[0]).trim() : undefined,
    nickname,
    publisher,
    headshot,
    sections,
    ispy: extractMarkerBlock(source, 'ispy'),
    finpub: extractMarkerBlock(source, 'finpub'),
    sourcePath: path,
  }
}

export function guruFileExists(name: string): boolean {
  return !!resolveFile(name)
}
