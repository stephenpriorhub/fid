import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Brain markdown + live API data is read at request time; never cache stale.
  experimental: {},
}

export default nextConfig
