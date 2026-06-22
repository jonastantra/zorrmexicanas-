import PostCard from '@/components/PostCard'
import { getRuntimeDb } from '@/lib/runtime-db'
import { listLatest, listPopular, listRandom, listTrending } from '@/lib/posts'

type Block = { block_key: string; title: string; block_type: string; item_limit: number }

export default function HomepageBlocks() {
  const blocks = getRuntimeDb().prepare(`
    SELECT block_key,title,block_type,item_limit
    FROM homepage_blocks WHERE enabled=1 ORDER BY position, rowid
  `).all() as Block[]

  return (
    <>
      {blocks.map(block => {
        const limit = Math.max(1, Math.min(block.item_limit, 48))
        const posts =
          block.block_type === 'popular' ? listPopular({ limit }) :
          block.block_type === 'random' ? listRandom({ limit }) :
          block.block_type === 'trending' ? listTrending({ limit }) :
          listLatest({ limit })
        if (!posts.length) return null
        return (
          <section className="section" key={block.block_key}>
            <div className="section-head"><h2 className="section-title">{block.title}</h2></div>
            <div className="post-grid">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
          </section>
        )
      })}
    </>
  )
}
