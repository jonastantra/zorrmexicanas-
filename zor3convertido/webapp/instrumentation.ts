// Next.js ejecuta register() una vez al arrancar el servidor.
// Solo en el runtime Node (no en Edge ni durante el build) iniciamos el
// scheduler interno del publicador automático.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Evitar arrancarlo durante el build de Next (la DB no existe ahí).
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  // Si la base es nueva (sitio recién creado), crear el esquema vacío ANTES de
  // servir, para que las primeras consultas no fallen.
  try {
    const { ensureCatalogSchema } = await import('@/lib/catalog-admin')
    ensureCatalogSchema()
  } catch (err) {
    console.error('[instrumentation] no se pudo asegurar el esquema:', err)
  }
  try {
    const { startScheduler } = await import('@/lib/auto-import/scheduler')
    startScheduler()
  } catch (err) {
    console.error('[instrumentation] no se pudo iniciar el scheduler:', err)
  }
  // ANALYZE inicial de la migration.db (una vez), sin bloquear el arranque.
  try {
    const { ensureCatalogStats } = await import('@/lib/catalog-admin')
    setTimeout(() => ensureCatalogStats(), 15000)
  } catch (err) {
    console.error('[instrumentation] no se pudo programar ANALYZE:', err)
  }
}
