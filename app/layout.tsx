import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'

export const metadata: Metadata = {
  title: 'FID — FinPub Intelligence Database',
  description: 'Intelligence briefings on financial-publishing gurus, products, and publishers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projectId = process.env.HUB_PROJECT_ID || ''
  return (
    <html lang="en">
      <body>
        <LayoutShell>{children}</LayoutShell>
        {/* afterInteractive: runs after hydration; hub-nav.js injects the global OxfordHub nav bar. */}
        <Script
          src="https://oxfordhub.app/hub-nav.js"
          data-project-id={projectId}
          strategy="afterInteractive"
          id="hub-nav"
        />
      </body>
    </html>
  )
}
