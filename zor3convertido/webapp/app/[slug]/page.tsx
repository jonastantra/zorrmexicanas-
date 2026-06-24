import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import PostCard from '@/components/PostCard'
import ShareButton from '@/components/ShareButton'
import VideoActions from '@/components/VideoActions'
import LazyVideoEmbed from '@/components/LazyVideoEmbed'
import AdSlot from '@/components/AdSlot'
import { getPostBySlug, getCanonicalForSlug, listRelated } from '@/lib/posts'
import { SITE_CONFIG } from '@/lib/site'
import { getPostMetrics } from '@/lib/runtime-db'
import { cleanText } from '@/lib/auto-import/sanitize'

/** Descripción pública limpia; si el excerpt está vacío usa una plantilla natural. */
function publicDescription(title: string, excerpt: string, category?: string): string {
  const cleaned = cleanText(excerpt)
  if (cleaned.length >= 60) return cleaned
  const cat = category ? `${category} ` : ''
  return cleanText(
    `${title}. Disfruta este video ${cat}en alta calidad, completo y sin cortes. ` +
    `Encuentra más contenido similar y descubre videos relacionados en nuestra colección.`
  )
}

export const revalidate = 300
export const dynamic = 'force-static'

function absoluteUrl(value: string): string {
  return new URL(value, SITE_CONFIG.baseUrl).toString()
}

function toIsoDuration(value: string | null): string | undefined {
  if (!value) return undefined
  const hours = value.match(/(\d+)\s*(?:h|hour)/i)?.[1]
  const minutes = value.match(/(\d+)\s*(?:min|minute)/i)?.[1]
  const seconds = value.match(/(\d+)\s*(?:sec|second)/i)?.[1]
  if (!hours && !minutes && !seconds) return undefined
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${seconds ? `${seconds}S` : ''}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: 'No encontrado' }
  const description = (post.excerpt || post.title).replace(/\s+/g, ' ').trim().slice(0, 160)
  const canonical = absoluteUrl(`/${post.slug}`)
  const image = absoluteUrl(post.thumb || '/og-default.svg')
  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      url: canonical,
      images: [{ url: image, width: 640, height: 360, alt: post.title }],
      type: 'video.other',
    },
    twitter: { card: 'summary_large_image', title: post.title, description, images: [image] },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
    },
  }
}

function extractEmbedSrc(embedHtml: string | null): string | null {
  if (!embedHtml) return null
  const normalized = embedHtml
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&quot;/gi, '"')
  const m = normalized.match(/src\s*=\s*["']([^"']+)["']/i)
  return m ? m[1] : null
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let post = getPostBySlug(slug)
  if (!post) {
    // If this slug belongs to a duplicate post, redirect (308) to the canonical.
    const canon = getCanonicalForSlug(slug)
    if (canon) {
      redirect(`/${canon.slug}`)
    }
    notFound()
  }
  // If post exists but is itself a duplicate (not canonical), forward to canonical.
  const canon = getCanonicalForSlug(slug)
  if (canon && canon.slug !== post.slug) {
    redirect(`/${canon.slug}`)
  }

  const embedSrc = extractEmbedSrc(post.embed)
  const related = listRelated(post.id, post.slug, { limit: 12 })
  const runtimeMetrics = getPostMetrics(post.id)
  const metrics = {
    views: Math.max(post.views, runtimeMetrics?.views || 0),
    likes: runtimeMetrics?.likes || 0,
    dislikes: runtimeMetrics?.dislikes || 0,
    shares: runtimeMetrics?.shares || 0,
  }

  // Strip WP block comments for clean text
  const cleanContent = (post.content || '')
    .replace(/<!--\s*\/?wp:[^>]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // El plugin genera content = "Título - NN min Descripción", que repite la
  // descripción (excerpt) que ya mostramos arriba. Si el content es básicamente
  // la misma descripción, no lo pintamos para no verse duplicado/robótico.
  const pubDesc = publicDescription(post.title, post.excerpt, post.categories[0]?.name)
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const nContent = normalize(cleanContent)
  const nDesc = normalize(pubDesc)
  const contentIsRedundant =
    !nContent || nDesc.length > 0 && (nContent.includes(nDesc) || nDesc.includes(nContent))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: post.title,
    description: post.excerpt || post.title,
    thumbnailUrl: [absoluteUrl(post.thumb || '/og-default.svg')],
    uploadDate: new Date(post.date.replace(' ', 'T') + 'Z').toISOString(),
    duration: toIsoDuration(post.duration),
    embedUrl: embedSrc || undefined,
    contentUrl: post.link || undefined,
    url: absoluteUrl(`/${post.slug}`),
    isFamilyFriendly: false,
    inLanguage: 'es-MX',
    interactionStatistic: post.views > 0 ? {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: post.views,
    } : undefined,
    keywords: [...post.categories.map(c => c.name), ...post.tags.map(t => t.name)].slice(0, 20).join(', '),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
      ...(post.categories[0] ? [{
        '@type': 'ListItem',
        position: 2,
        name: post.categories[0].name,
        item: absoluteUrl(`/categoria/${post.categories[0].slug}`),
      }] : []),
      {
        '@type': 'ListItem',
        position: post.categories[0] ? 3 : 2,
        name: post.title,
        item: absoluteUrl(`/${post.slug}`),
      },
    ],
  }

  return (
    <div className="post-detail-page">
      <article className="post-detail">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Inicio</Link>
          {post.categories[0] && (
            <>
              <span className="sep">›</span>
              <Link href={`/categoria/${post.categories[0].slug}`}>{post.categories[0].name}</Link>
            </>
          )}
          <span className="sep">›</span>
          <span style={{ color: 'var(--text-soft)' }}>{post.title.slice(0, 40)}{post.title.length > 40 ? '…' : ''}</span>
        </nav>

        <h1>{post.title}</h1>

        <div className="post-detail-meta">
          <span>📅 {new Date(post.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          {post.duration && <span>⏱️ {post.duration}</span>}
          {post.views > 0 && <span>👁️ {post.views.toLocaleString()} vistas</span>}
        </div>

        {embedSrc && (
          <LazyVideoEmbed src={embedSrc} title={post.title} poster={post.thumb} />
        )}

        <VideoActions postId={post.id} title={post.title} initial={metrics} />
        <AdSlot slot="below_player" />

        <div className="post-detail-actions">
          {/* "Ver fuente original" oculto a propósito: el dato post.link se conserva en la base
              (lo usa el JSON-LD contentUrl), pero no se expone al público. */}
          <ShareButton title={post.title} url={`/${post.slug}`} />
        </div>

        <div className="post-detail-excerpt">
          {pubDesc}
        </div>

        {cleanContent && !contentIsRedundant && (
          <div className="post-detail-content">
            <p>{cleanContent}</p>
          </div>
        )}

        {post.categories.length > 0 && (
          <div className="category-list">
            <span className="list-label">Categorías:</span>
            {post.categories.map(c => (
              <Link key={c.slug} href={`/categoria/${c.slug}`}>{c.name}</Link>
            ))}
          </div>
        )}

        {post.tags.length > 0 && (
          <div className="tag-list">
            <span className="list-label">Etiquetas:</span>
            {post.tags.map(t => (
              <Link key={t.slug} href={`/etiqueta/${t.slug}`}>{t.name}</Link>
            ))}
          </div>
        )}

        {related.length > 0 && (
          <section className="section" style={{ marginTop: 40 }}>
            <div className="section-head">
              <h2 className="section-title">📺 Videos relacionados</h2>
            </div>
            <div className="post-grid">
              {related.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          </section>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </article>

    </div>
  )
}
