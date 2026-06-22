import { NextResponse } from 'next/server'
import { getRuntimeDb } from '@/lib/runtime-db'

export async function POST(request: Request) {
  const { blocks } = await request.json()
  if (!Array.isArray(blocks)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const db = getRuntimeDb()
  const update = db.prepare(`
    UPDATE homepage_blocks SET title=?,block_type=?,item_limit=?,position=?,enabled=?,updated_at=CURRENT_TIMESTAMP
    WHERE block_key=?
  `)
  db.transaction(() => blocks.forEach((block: any) => update.run(
    String(block.title || '').slice(0, 80),
    ['latest','popular','trending','random'].includes(block.block_type) ? block.block_type : 'latest',
    Math.max(1, Math.min(Number(block.item_limit) || 8, 48)),
    Number(block.position) || 0,
    block.enabled ? 1 : 0,
    block.block_key,
  )))()
  return NextResponse.json({ ok: true })
}
