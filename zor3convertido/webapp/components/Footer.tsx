import Link from 'next/link'
import { SITE_CONFIG } from '@/lib/site'
import type { TermInfo } from '@/lib/posts'

export default function Footer({ categories, tags }: { categories: TermInfo[]; tags: TermInfo[] }) {
  const year = new Date().getFullYear()
  const topCats = categories.slice(0, 6)
  const topTags = tags.slice(0, 12)

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <div className="footer-brand">
            <span className="brand-mark" aria-hidden>🔥</span>
            {SITE_CONFIG.name}
          </div>
          <p className="footer-tagline">
            {SITE_CONFIG.description}
          </p>
          <span className="age-notice">🔞 Solo para mayores de 18 años</span>
        </div>

        <div>
          <h4>Categorías</h4>
          <ul>
            {topCats.map(c => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Etiquetas populares</h4>
          <ul>
            {topTags.slice(0, 8).map(t => (
              <li key={t.id}>
                <Link href={`/etiqueta/${t.slug}`}>#{t.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Información</h4>
          <ul>
            <li><Link href="/buscar">Buscar videos</Link></li>
            <li><Link href="/sitemap.xml">Mapa del sitio</Link></li>
            <li><a href="#" rel="nofollow">Términos de uso</a></li>
            <li><a href="#" rel="nofollow">Política de privacidad</a></li>
            <li><a href="#" rel="nofollow">DMCA / 2257</a></li>
            <li><a href="#" rel="nofollow">Contacto</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>© {year} {SITE_CONFIG.name} · Todos los derechos reservados</div>
        <div>
          Este sitio contiene material para adultos. Todas las modelos son mayores de 18 años.
          Cumplimos con 18 U.S.C. 2257.
        </div>
      </div>
    </footer>
  )
}
