import { NextResponse } from 'next/server'
import { discover, rewritePending, scheduleDaily, publishDue, fullCycle, improveExisting } from '@/lib/auto-import/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Endpoint para cron externo (EasyPanel / VPS).
// Requiere: Authorization: Bearer $AUTO_IMPORT_SECRET
function authorized(request: Request): boolean {
  const secret = process.env.AUTO_IMPORT_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const action = new URL(request.url).searchParams.get('action') || 'publish-due'
  try {
    switch (action) {
      case 'discover':
        return NextResponse.json(await discover())
      case 'rewrite':
        return NextResponse.json(await rewritePending())
      case 'schedule':
        return NextResponse.json(scheduleDaily())
      case 'publish-due':
        return NextResponse.json(await publishDue())
      case 'full-cycle':
        return NextResponse.json(await fullCycle())
      case 'improve':
        return NextResponse.json(await improveExisting(Number(new URL(request.url).searchParams.get('limit')) || 50))
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

export const POST = handle
// Permitir GET para crons simples basados en curl sin -X POST.
export const GET = handle
