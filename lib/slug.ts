const COMBINING_MARKS = /[̀-ͯ]/g

/** Canonical slug from an entity name. Stable + reversible-enough for routing. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '') // strip accents
    .replace(/['’.]/g, '') // drop apostrophes/periods
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
