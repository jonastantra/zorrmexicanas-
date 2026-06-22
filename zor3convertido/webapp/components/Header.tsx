'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SITE_CONFIG } from '@/lib/site'
import type { TermInfo } from '@/lib/posts'

export default function Header({ categories }: { categories: TermInfo[] }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const topCats = categories.slice(0, 7)

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand" aria-label={SITE_CONFIG.name}>
            <span className="brand-mark" aria-hidden>ZM</span>
            <span>{SITE_CONFIG.name}</span>
          </Link>

          <nav className="site-nav" aria-label="Categorías principales">
            {topCats.map(c => (
              <Link key={c.id} href={`/categoria/${c.slug}`}>{c.name}</Link>
            ))}
          </nav>

          <form className="search-form" action="/buscar" method="get" role="search">
            <input type="search" name="q" placeholder="Buscar videos" aria-label="Buscar videos" />
            <button type="submit">Buscar</button>
          </form>

          <button
            type="button"
            className="menu-toggle"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(open => !open)}
          >
            {mobileOpen ? 'Cerrar' : 'Menú'}
          </button>
        </div>
      </header>

      <nav className={`mobile-menu ${mobileOpen ? 'open' : ''}`} aria-label="Categorías móviles">
        {categories.map(c => (
          <Link key={c.id} href={`/categoria/${c.slug}`} onClick={() => setMobileOpen(false)}>
            {c.name}
            <span>{c.count.toLocaleString()}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
