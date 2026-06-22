import Link from 'next/link'
import Image from 'next/image'
import type { PostListItem } from '@/lib/site'

// Domains Next.js Image is allowed to optimize
const PROXY_THUMB_HOSTS = ['xvideos-cdn.com', 'phncdn.com', 'pornhub.com', 'redtube.com', 'youporn.com', 'xhamster.com', 'ytimg.com']

function processThumb(url: string | null): string | null {
  if (!url) return null
  // Return as-is; Next/Image will proxy allowed domains, <img> handles the rest
  return url
}

function isNew(date: string): boolean {
  const d = new Date(date)
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  return days <= 7
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

export default function PostCard({ post, priority = false, badge }: { post: PostListItem; priority?: boolean; badge?: 'new' | 'hot' | 'trending' }) {
  const thumb = processThumb(post.thumb)
  const primaryCat = post.categories[0]
  const newPost = isNew(post.date)

  return (
    <Link href={`/${post.slug}`} className="post-card" aria-label={post.title}>
      <div className="post-card-thumb">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={post.title}
            width="640"
            height="360"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="post-card-thumb-placeholder">
            {post.duration || 'Sin miniatura'}
          </div>
        )}

        <div className="post-card-overlay" aria-hidden />
        <div className="post-card-play" aria-hidden>▶</div>

        {(badge || (newPost && !badge)) && (
          <div className="post-card-badges">
            {badge === 'hot' && <span className="badge badge-hot">🔥 Hot</span>}
            {badge === 'trending' && <span className="badge badge-trending">📈 Trending</span>}
            {!badge && newPost && <span className="badge badge-new">Nuevo</span>}
          </div>
        )}

        {post.duration && <span className="post-card-duration">{post.duration}</span>}
      </div>

      <div className="post-card-info">
        <h3 className="post-card-title">{post.title}</h3>
        <div className="post-card-meta">
          {primaryCat && <span>{primaryCat.name}</span>}
          {post.views > 0 && (
            <>
              <span className="dot">·</span>
              <span>👁 {fmtViews(post.views)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
