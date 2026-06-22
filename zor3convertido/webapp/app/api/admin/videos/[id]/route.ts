import { NextResponse } from 'next/server'
import { openCatalogAdmin, setPostMeta } from '@/lib/catalog-admin'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  const body = await request.json()
  const db = openCatalogAdmin()
  try {
    db.transaction(() => {
      db.prepare(`UPDATE posts SET post_title=?,post_name=?,post_excerpt=?,post_content=?,post_modified=datetime('now') WHERE id=?`)
        .run(String(body.title || '').slice(0, 250), String(body.slug || '').trim(), String(body.excerpt || ''), String(body.content || ''), id)
      for (const [key, value] of Object.entries({
        embed: body.embed, link: body.link, duration: body.duration, videoid: body.videoId, thumb: body.thumb,
      })) setPostMeta(db, id, key, String(value || ''))
    })()
    return NextResponse.json({ ok: true })
  } finally { db.close() }
}
