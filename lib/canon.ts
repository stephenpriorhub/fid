/**
 * Canonicalize entity names so variants collapse to one node (and one slug).
 * Both the directory parser and the Promo Analyzer entities client run names
 * through these before building nodes, so e.g. "Banyan Hill / Money and Markets"
 * and "Banyan Hill" become a single publisher.
 */

// Known publisher name variants → canonical form (keys are lowercased).
const PUBLISHER_ALIASES: Record<string, string> = {
  'banyan hill / money and markets': 'Banyan Hill',
  'money and markets': 'Banyan Hill',
  'oxford club': 'The Oxford Club',
  'porter & company': 'Porter & Co.',
}

export function canonicalPublisher(name: string): string {
  // Drop a trailing "(...)" family/status suffix, e.g. "Paradigm Press (Agora)".
  const stripped = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const alias = PUBLISHER_ALIASES[stripped.toLowerCase()]
  return alias || stripped || 'Independent'
}

const GURU_ALIASES: Record<string, string> = {}

export function canonicalGuru(name: string): string {
  // Competitor rows sometimes carry a " - Publisher" disambiguator; drop it.
  const stripped = name.replace(/\s+-\s+.*$/, '').trim()
  return GURU_ALIASES[stripped.toLowerCase()] || stripped || name.trim()
}
