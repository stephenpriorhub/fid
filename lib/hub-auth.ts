const HUB_URL = process.env.HUB_URL || 'https://oxfordhub.app'
// New OxfordHub project id for FID — set via HUB_PROJECT_ID env var once registered.
const PROJECT_ID = process.env.HUB_PROJECT_ID || ''

export interface HubUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'user'
}

export async function verifyHubSession(
  cookieHeader: string
): Promise<{ authorized: boolean; user?: HubUser }> {
  try {
    const res = await fetch(`${HUB_URL}/api/verify?projectId=${PROJECT_ID}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return { authorized: false }
    return await res.json()
  } catch {
    return { authorized: false }
  }
}

export function isAdmin(user?: HubUser): boolean {
  return user?.role === 'super_admin' || user?.role === 'admin'
}
