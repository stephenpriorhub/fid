import Link from 'next/link'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen mt-12">
      <header className="sticky top-12 z-10 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-bold tracking-tight text-[var(--accent)]">
            FID
          </Link>
          <span className="text-xs text-[var(--muted)] hidden sm:inline">
            FinPub Intelligence Database
          </span>
          <nav className="ml-auto flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/?type=guru" className="hover:text-[var(--foreground)]">Gurus</Link>
            <Link href="/?type=product" className="hover:text-[var(--foreground)]">Products</Link>
            <Link href="/?type=publisher" className="hover:text-[var(--foreground)]">Publishers</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
