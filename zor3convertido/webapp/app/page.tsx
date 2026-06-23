import Link from 'next/link'
import Hero from '@/components/Hero'
import Pagination from '@/components/Pagination'
import HomepageBlocks from '@/components/HomepageBlocks'
import {
  getStats,
  getFeatured,
  listFeaturedCategories,
  listPopularTags,
} from '@/lib/posts'
import { SEARCH_CONSOLE_TOPICS, SITE_CONFIG } from '@/lib/site'

// ISR: la home se renderiza una vez cada 5 min y se sirve de caché el resto.
// Antes era force-dynamic y ejecutaba stats + bloques + ORDER BY RANDOM() en
// CADA visita (incluidos bots), saturando el CPU del VPS. El bloque "random"
// ahora rota cada revalidación en lugar de en cada request.
export const revalidate = 300

export default function HomePage() {
  const stats = getStats()
  const pages = Math.max(1, Math.ceil(stats.posts / SITE_CONFIG.postsPerPage))
  const featured = getFeatured()
  const featuredCats = listFeaturedCategories(12)
  const popularTags = listPopularTags(40)
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '¿Dónde encontrar porno casero mexicano en Zorritas Mexicanas?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'La categoría Amateur Casero reúne videos caseros mexicanos y contenido amateur latino con páginas individuales, miniaturas locales y videos relacionados.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Qué incluye la categoría Porno Mexicano?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Incluye videos mexicanos organizados por popularidad, fecha, categorías, etiquetas y duración para facilitar la navegación desde móvil o escritorio.',
        },
      },
    ],
  }

  return (
    <div>
      <header className="home-intro">
        <div>
          <h1 className="page-title">Porno mexicano casero y videos amateur latinos</h1>
          <p className="page-subtitle">
            Página de porno mexicano con {stats.posts.toLocaleString()} videos, {stats.categories} categorías y {stats.tags.toLocaleString()} etiquetas: mexicanas, amateur casero, colegialas y tendencias latinas.
          </p>
        </div>
      </header>

      {featured ? <Hero post={featured} /> : null}

      <section className="section seo-topic-section" aria-labelledby="search-console-topics">
        <div className="section-head">
          <h2 className="section-title" id="search-console-topics">Búsquedas populares</h2>
          <span className="section-meta">Basado en consultas reales de Google Search Console</span>
        </div>
        <div className="topic-chip-row">
          {SEARCH_CONSOLE_TOPICS.map(topic => (
            <Link key={topic.label} href={topic.href}>
              {topic.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="featured-cats">
        <div className="section-head">
          <h2 className="section-title" id="featured-cats">Categorías de porno mexicano</h2>
        </div>
        <div className="cat-grid">
          {featuredCats.map(category => (
            <Link key={category.id} href={`/categoria/${category.slug}`} className="cat-card">
              <div className="cat-card-content">
                <div className="cat-card-name">{category.name}</div>
                <div className="cat-card-count">{category.count.toLocaleString()} videos</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <HomepageBlocks />
      <Pagination page={1} pages={pages} basePath="/" />

      <section className="section tag-section" aria-labelledby="popular-tags">
        <div className="section-head">
          <h2 className="section-title" id="popular-tags">Explorar por etiquetas</h2>
        </div>
        <div className="tag-cloud">
          {popularTags.map(tag => (
            <Link key={tag.id} href={`/etiqueta/${tag.slug}`}>
              #{tag.name} <span>· {tag.count.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}
