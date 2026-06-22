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
import { SITE_CONFIG } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const stats = getStats()
  const pages = Math.max(1, Math.ceil(stats.posts / SITE_CONFIG.postsPerPage))
  const featured = getFeatured()
  const featuredCats = listFeaturedCategories(12)
  const popularTags = listPopularTags(40)

  return (
    <div>
      <header className="home-intro">
        <div>
          <h1 className="page-title">Videos mexicanos y latinos</h1>
          <p className="page-subtitle">
            {stats.posts.toLocaleString()} videos · {stats.categories} categorías · {stats.tags.toLocaleString()} etiquetas
          </p>
        </div>
      </header>

      {featured ? <Hero post={featured} /> : null}

      <section className="section" aria-labelledby="featured-cats">
        <div className="section-head">
          <h2 className="section-title" id="featured-cats">Categorías</h2>
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
    </div>
  )
}
