import { join, resolve } from 'path'

/** Read at request time — do not cache at module scope (standalone build env). */
export function getVaultPath(): string {
  return (
    process.env.VAULT_PATH ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    '/data/vault'
  )
}

export function getResourcesBase(): string {
  return resolve(join(getVaultPath(), 'Resources'))
}

export function getExpertsBase(): string {
  return resolve(join(getResourcesBase(), 'Experts'))
}

export function getCompetitorsBase(): string {
  return resolve(join(getResourcesBase(), 'Competitors'))
}

export function getPublicationsBase(): string {
  return resolve(join(getResourcesBase(), 'Publication Descriptions'))
}

export function getDirectoryPath(): string {
  return resolve(join(getResourcesBase(), 'Financial Publishing Directory.md'))
}

export function getKnowledgeGraphPath(): string {
  return resolve(join(getResourcesBase(), 'Financial Publishing Knowledge Graph.md'))
}
