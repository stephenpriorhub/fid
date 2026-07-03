import { marked } from 'marked'
import { stripWikilinks } from '@/lib/markdown'

marked.setOptions({ gfm: true, breaks: false })

/** Render trusted brain-vault markdown. Wikilinks are flattened to plain text first. */
export default function Markdown({ children }: { children: string }) {
  if (!children?.trim()) return null
  const html = marked.parse(stripWikilinks(children), { async: false }) as string
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
