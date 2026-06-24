import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { getTermBySlug, listPosts, listCategories } from '@/lib/posts'
import { CATEGORY_SEO_COPY, SITE_CONFIG } from '@/lib/site'

export const revalidate = 600

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = Math.max(1, parseInt((await searchParams).page || '1', 10) || 1)
  const cat = getTermBySlug(slug, 'category')
  if (!cat) return { title: 'Categoría no encontrada' }
  const seo = CATEGORY_SEO_COPY[cat.slug]
  const titleBase = seo?.title || `${cat.name} - Videos porno mexicano`
  const description = seo?.description || `Videos de ${cat.name}. ${cat.count.toLocaleString()} videos disponibles en Zorritas Mexicanas.`

  return {
    title: `${titleBase}${page > 1 ? ` - Página ${page}` : ''}`,
    description,
    keywords: [cat.name, 'porno mexicano', 'porno casero mexicano', 'videos mexicanos', 'mexicanas amateur'],
    alternates: { canonical: `/categoria/${cat.slug}${page > 1 ? `?page=${page}` : ''}` },
    openGraph: {
      type: 'website',
      title: `${titleBase}${page > 1 ? ` - Página ${page}` : ''}`,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
    },
  }
}

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const cat = getTermBySlug(slug, 'category')
  if (!cat) notFound()

  const page = parseInt(sp.page || '1', 10) || 1
  const { posts, pages } = listPosts({ categorySlug: slug, page, perPage: SITE_CONFIG.postsPerPage })
  const seo = CATEGORY_SEO_COPY[cat.slug]

  const siblingCats = listCategories({ minCount: 1500, limit: 18 })
    .filter(c => c.slug !== slug)
    .slice(0, 12)

  const base = SITE_CONFIG.baseUrl.replace(/\/$/, '')
  const categoryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: seo?.title || cat.name,
    description: seo?.description || cat.description || `Videos de ${cat.name}`,
    url: `${base}/categoria/${cat.slug}`,
    isFamilyFriendly: false,
    inLanguage: 'es-MX',
    about: ['porno mexicano', cat.name, 'videos mexicanos'],
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: cat.name, item: `${base}/categoria/${cat.slug}` },
    ],
  }

  return (
    <div>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Inicio</Link>
        <span className="sep">›</span>
        <span>Categoría</span>
        <span className="sep">›</span>
        <span style={{ color: 'var(--text-soft)' }}>{cat.name}</span>
      </nav>

      <header className="category-hero">
        <h1 className="page-title" style={{ color: 'white', marginBottom: 6 }}>
          {seo?.title || cat.name}
        </h1>
        <p style={{ opacity: 0.95, fontSize: 14 }}>
          {cat.count.toLocaleString()} videos en esta categoría
        </p>
        {cat.description && (
          <p style={{ marginTop: 10, opacity: 0.85, fontSize: 13, maxWidth: 720 }}>{cat.description}</p>
        )}
        {seo && <p style={{ marginTop: 10, opacity: 0.9, fontSize: 14, maxWidth: 760 }}>{seo.description}</p>}
      </header>

      <div className="category-row">
        {siblingCats.map(c => (
          <Link key={c.id} href={`/categoria/${c.slug}`}>
            {c.name} <span style={{ opacity: 0.5, fontSize: 11 }}>({c.count.toLocaleString()})</span>
          </Link>
        ))}
      </div>

      {posts.length > 0 ? (
        <>
          <div className="post-grid">
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
          <Pagination page={page} pages={pages} basePath={`/categoria/${slug}`} />
        </>
      ) : (
        <div className="empty">
          <div className="empty-icon">🎬</div>
          <h2>No hay videos en esta categoría</h2>
          <p><Link href="/" className="action-btn">← Volver al inicio</Link></p>
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  )
}
