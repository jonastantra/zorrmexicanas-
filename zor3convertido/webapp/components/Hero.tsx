import Link from 'next/link'
import type { Post } from '@/lib/site'

export default function Hero({ post }: { post: Post }) {
  return (
    <section className="hero" aria-label="Video destacado">
      <Link href={`/${post.slug}`}>
        {post.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumb}
            alt={post.title}
            width="1280"
            height="720"
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : <div className="hero-placeholder" />}
        <div className="hero-overlay">
          <h2 className="hero-title">{post.title}</h2>
          <div className="hero-meta">
            {post.duration ? <span>{post.duration}</span> : null}
            {post.views > 0 ? <span>{post.views.toLocaleString()} vistas</span> : null}
            {post.categories[0] ? <span>{post.categories[0].name}</span> : null}
          </div>
        </div>
      </Link>
    </section>
  )
}
