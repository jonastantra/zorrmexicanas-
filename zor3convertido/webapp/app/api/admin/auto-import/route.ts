import { NextResponse } from 'next/server'
import {
  discover, rewritePending, scheduleDaily, publishDue, fullCycle, repairExisting,
  listQueue, regenerateOne, editRow, setRowStatus, deleteRow, clearFailed, retryFailed,
  publishOne,
} from '@/lib/auto-import/engine'
import { getSettings, setSettings, listRuns, DEFAULT_SETTINGS } from '@/lib/auto-import/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'all'
  const search = url.searchParams.get('search') || undefined
  const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0
  const { rows, total, counts } = listQueue({ status, search, offset })
  return NextResponse.json({ settings: getSettings(), rows, total, counts, runs: listRuns(15) })
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    /* algunas acciones no llevan body */
  }
  const url = new URL(request.url)
  const action = url.searchParams.get('action') || String(body.action || '')
  const id = Number(body.id)

  try {
    switch (action) {
      case 'save-settings': {
        const incoming = (body.settings || {}) as Record<string, string>
        // Solo persistir claves conocidas.
        const clean: Record<string, string> = {}
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          if (incoming[key] !== undefined) clean[key] = String(incoming[key])
        }
        setSettings(clean)
        return NextResponse.json({ ok: true, settings: getSettings() })
      }
      case 'discover':
        return NextResponse.json(await discover())
      case 'rewrite':
        return NextResponse.json(await rewritePending(Number(body.batch) || undefined))
      case 'schedule':
        return NextResponse.json(scheduleDaily(Number(body.limit) || undefined))
      case 'publish-due':
        return NextResponse.json(await publishDue())
      case 'full-cycle':
        return NextResponse.json(await fullCycle())
      case 'repair':
        return NextResponse.json(await repairExisting(Number(body.limit) || 20))
      case 'regenerate':
        return NextResponse.json(await regenerateOne(id))
      case 'edit':
        return NextResponse.json(editRow(id, (body.fields || {}) as Record<string, string>))
      case 'publish-now':
        return NextResponse.json(await publishOne(id))
      case 'pause':
        setRowStatus(id, 'needs_review')
        return NextResponse.json({ ok: true })
      case 'resume':
        setRowStatus(id, 'rewritten')
        return NextResponse.json({ ok: true })
      case 'skip':
        setRowStatus(id, 'skipped')
        return NextResponse.json({ ok: true })
      case 'delete':
        deleteRow(id)
        return NextResponse.json({ ok: true })
      case 'clear-failed':
        return NextResponse.json({ ok: true, removed: clearFailed() })
      case 'retry-failed':
        return NextResponse.json({ ok: true, restored: retryFailed() })
      default:
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
