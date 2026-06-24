// Next.js ejecuta register() una vez al arrancar el servidor.
// Solo en el runtime Node (no en Edge ni durante el build) iniciamos el
// scheduler interno del publicador automático.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Evitar arrancarlo durante el build de Next (la DB no existe ahí).
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  try {
    const { startScheduler } = await import('@/lib/auto-import/scheduler')
    startScheduler()
  } catch (err) {
    console.error('[instrumentation] no se pudo iniciar el scheduler:', err)
  }
}
