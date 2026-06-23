import Link from 'next/link'
import { SITE_CONFIG } from '@/lib/site'
import type { TermInfo } from '@/lib/posts'

export default function Header({ categories }: { categories: TermInfo[] }) {
  const topCats = categories.slice(0, 7)

  return (
    <details className="mobile-navigation">
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand" aria-label={SITE_CONFIG.name}>
            <span className="brand-mark" aria-hidden>ZM</span>
            <span>{SITE_CONFIG.name}</span>
          </Link>

          <nav className="site-nav" aria-label="Categorías principales">
            {topCats.map(category => (
              <Link key={category.id} href={`/categoria/${category.slug}`}>{category.name}</Link>
            ))}
          </nav>

          <form className="search-form" action="/buscar" method="get" role="search">
            <input type="search" name="q" placeholder="Buscar videos" aria-label="Buscar videos" />
            <button type="submit">Buscar</button>
          </form>

          <summary className="menu-toggle" aria-label="Abrir menú">Menú</summary>
        </div>
      </header>

      <nav className="mobile-menu" aria-label="Categorías móviles">
        {categories.map(category => (
          <Link key={category.id} href={`/categoria/${category.slug}`}>
            {category.name}
            <span>{category.count.toLocaleString()}</span>
          </Link>
        ))}
      </nav>
    </details>
  )
}
