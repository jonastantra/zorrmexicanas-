import { NextResponse } from 'next/server'
import { getRuntimeDb } from '@/lib/runtime-db'

export async function POST(request: Request) {
  const { ads } = await request.json()
  if (!Array.isArray(ads)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const db = getRuntimeDb()
  const allowed = new Set(
    (db.prepare(`SELECT slot_key FROM ad_slots`).all() as { slot_key: string }[]).map(row => row.slot_key),
  )
  const update = db.prepare(`
    UPDATE ad_slots SET html=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE slot_key=?
  `)
  db.transaction(() => {
    for (const ad of ads) {
      if (!allowed.has(ad.slot_key)) continue
      update.run(String(ad.html || ''), ad.enabled ? 1 : 0, ad.slot_key)
    }
  })()
  return NextResponse.json({ ok: true })
}
