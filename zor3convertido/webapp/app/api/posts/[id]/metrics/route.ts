import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeDb } from '@/lib/runtime-db'

const allowed = new Set(['view', 'like', 'dislike', 'share'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const postId = Number((await params).id)
  const { action } = await request.json()
  if (!Number.isInteger(postId) || !allowed.has(action)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const forwarded = request.headers.get('x-forwarded-for') || 'local'
  const agent = request.headers.get('user-agent') || ''
  const day = new Date().toISOString().slice(0, 10)
  const identity = crypto.createHash('sha256').update(`${forwarded}|${agent}`).digest('hex')
  const period = action === 'view' ? day : 'forever'
  const actionKey = `${postId}:${action}:${period}:${identity}`
  const db = getRuntimeDb()

  const transaction = db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO post_metrics(post_id) VALUES(?)`).run(postId)
    const inserted = db.prepare(`
      INSERT OR IGNORE INTO visitor_actions(action_key,post_id,action) VALUES(?,?,?)
    `).run(actionKey, postId, action)
    if (inserted.changes) {
      const column = action === 'view' ? 'views' : `${action}s`
      db.prepare(`UPDATE post_metrics SET ${column}=${column}+1,updated_at=CURRENT_TIMESTAMP WHERE post_id=?`).run(postId)
    }
    return db.prepare(`SELECT views,likes,dislikes,shares FROM post_metrics WHERE post_id=?`).get(postId)
  })
  return NextResponse.json(transaction())
}
