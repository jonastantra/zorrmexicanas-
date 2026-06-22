import { spawn } from 'child_process'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const localAddresses = ['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1']
  const local = localAddresses.includes(host)
  const forwardedAddress = (forwarded || '').split(',')[0].trim().toLowerCase()
  const forwardedIsLocal = !forwardedAddress || localAddresses.includes(forwardedAddress)
  if (process.env.MAINTENANCE_ENABLED !== '1' && (!local || !forwardedIsLocal)) {
    return NextResponse.json({ error: 'Mantenimiento desactivado fuera del equipo local.' }, { status: 403 })
  }

  const { action } = await request.json()
  const root = path.resolve(process.cwd(), '..', '..')
  const commands: Record<string, string[]> = {
    audit: [path.join(root, 'audit-video-health.py')],
    thumbnails: [path.join(root, 'download-real-thumbnails.py'), '--workers', '6', '--timeout', '15'],
    repair: [path.join(root, 'repair-dead-videos.py'), '--apply', '--limit', '5', '--pages', '2'],
    'repair-all': [path.join(root, 'repair-all-dead-videos.py'), '--batch-size', '100', '--pages-per-query', '5', '--pause', '2'],
  }
  const args = commands[action]
  if (!args) return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })

  const child = spawn('python', args, {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  })
  child.unref()
  return NextResponse.json({ message: `Proceso “${action}” iniciado. Actualiza el panel en unos minutos.` })
}
