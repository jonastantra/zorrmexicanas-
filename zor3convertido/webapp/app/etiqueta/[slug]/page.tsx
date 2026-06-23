import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { getTermBySlug, listPosts, listTags } from '@/lib/posts'
import { SITE_CONFIG } from '@/lib/site'

export const revalidate = 600

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = Math.max(1, parseInt((await searchParams).page || '1', 10) || 1)
  const tag = getTermBySlug(slug, 'post_tag')
  if (!tag) return { title: 'Etiqueta no encontrada' }
  return {
    title: `#${tag.name} - Videos Porno${page > 1 ? ` - Página ${page}` : ''}`,
    description: `Videos etiquetados con ${tag.name}. ${tag.count.toLocaleString()} videos disponibles.`,
    alternates: { canonical: `/etiqueta/${tag.slug}${page > 1 ? `?page=${page}` : ''}` },
  }
}

export default async function TagPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const tag = getTermBySlug(slug, 'post_tag')
  if (!tag) notFound()

  const page = parseInt(sp.page || '1', 10) || 1
  const { posts, pages } = listPosts({ tagSlug: slug, page, perPage: SITE_CONFIG.postsPerPage })

  // Related tags (similar popularity tier, exclude self)
  const relatedTags = listTags({ minCount: Math.max(1000, Math.floor(tag.count * 0.5)), limit: 20 })
    .filter(t => t.slug !== slug)
    .slice(0, 14)

  return (
    <div>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Inicio</Link>
        <span className="sep">›</span>
        <span>Etiqueta</span>
        <span className="sep">›</span>
        <span style={{ color: 'var(--text-soft)' }}>#{tag.name}</span>
      </nav>

      <header style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: 24,
        color: 'white',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <h1 className="page-title" style={{ color: 'white', marginBottom: 6 }}>#{tag.name}</h1>
        <p style={{ opacity: 0.95, fontSize: 14 }}>
          {tag.count.toLocaleString()} videos con esta etiqueta
        </p>
      </header>

      {relatedTags.length > 0 && (
        <div className="tag-cloud" style={{ marginBottom: 24 }}>
          {relatedTags.map(t => (
            <Link key={t.id} href={`/etiqueta/${t.slug}`}>
              #{t.name} <span style={{ opacity: 0.6 }}>· {t.count.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}

      {posts.length > 0 ? (
        <>
          <div className="post-grid">
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
          <Pagination page={page} pages={pages} basePath={`/etiqueta/${slug}`} />
        </>
      ) : (
        <div className="empty">
          <div className="empty-icon">🏷️</div>
          <h2>No hay videos con esta etiqueta</h2>
          <p><Link href="/" className="action-btn">← Volver al inicio</Link></p>
        </div>
      )}
    </div>
  )
}
