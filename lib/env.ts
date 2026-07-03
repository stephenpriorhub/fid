/** Read an env var at request time (standalone build — do not cache at module scope). */
export function getEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}
