// Scheduler interno del publicador automático.
// Corre dentro del proceso del contenedor (un setInterval), así no dependemos de
// crons externos ni de clics en el panel. Pensado para UNA sola instancia
// (VPS básico / EasyPanel sin réplicas). Si algún día hay varias réplicas, hay
// que mover esto a un cron externo para evitar ciclos duplicados.
import { settingBool, settingInt, getSetting, setSettings } from './db'
import { fullCycle, publishDue, revalidateReview, scheduleDaily, improveExisting } from './engine'

let started = false
let ticking = false

// Cada cuánto despierta el loop. La publicación de vencidos se evalúa en cada
// tick; el ciclo diario (descubrir→reescribir→programar) solo una vez al día.
const TICK_MS = 5 * 60 * 1000 // 5 min
const FIRST_DELAY_MS = 30 * 1000 // esperar al arranque para no chocar con el build/boot

function localShiftedNow(): Date {
  const offsetMin = settingInt('tz_offset_minutes', -360)
  return new Date(Date.now() + offsetMin * 60000)
}

/** Fecha local (YYYY-MM-DD) según tz_offset, para el candado del ciclo diario. */
function localDateStr(): string {
  return localShiftedNow().toISOString().slice(0, 10)
}

async function tick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    if (!settingBool('enabled')) return
    if (getSetting('auto_scheduler') === 'false') return

    // 1) Ciclo diario: una vez por día local, a partir de la hora de inicio.
    const localHour = localShiftedNow().getUTCHours()
    const startHour = settingInt('schedule_start_hour', 8)
    const today = localDateStr()
    if (localHour >= startHour && getSetting('sched_last_cycle_day') !== today) {
      // Marcar ANTES de empezar para que un reinicio a media tarea no repita el
      // ciclo completo (descubrir/reescribir son ráfagas de CPU y cuota de IA).
      setSettings({ sched_last_cycle_day: today })
      try {
        revalidateReview() // rescata needs_review con las reglas actuales
        await fullCycle() // discover → rewrite → scheduleDaily (respeta daily_limit)
      } catch (err) {
        console.error('[auto-scheduler] ciclo diario falló:', err instanceof Error ? err.message : err)
      }
    }

    // 1b) Mejora masiva de posts viejos: un lote al día, solo si está activada
    //     (opt-in porque consume IA). Marca el día para correr una sola vez.
    if (getSetting('auto_improve') === 'true' &&
        localHour >= startHour && getSetting('sched_last_improve_day') !== today) {
      setSettings({ sched_last_improve_day: today })
      try {
        await improveExisting(settingInt('improve_daily_batch', 150))
      } catch (err) {
        console.error('[auto-scheduler] mejora masiva falló:', err instanceof Error ? err.message : err)
      }
    }

    // 2) Rescatar needs_review que ya pasan las reglas actuales (barato, sin IA)
    //    y rellenar la programación hasta el cupo diario. Ambas son baratas y
    //    idempotentes: scheduleDaily cuenta lo ya programado/publicado hoy, así
    //    que correrlo en cada tick solo completa hasta daily_limit.
    try {
      revalidateReview()
      scheduleDaily()
    } catch (err) {
      console.error('[auto-scheduler] revalidate/schedule falló:', err instanceof Error ? err.message : err)
    }

    // 3) Publicar lo que ya venció (scheduled_at <= now), hasta max_per_run.
    try {
      await publishDue()
    } catch (err) {
      console.error('[auto-scheduler] publishDue falló:', err instanceof Error ? err.message : err)
    }
  } finally {
    ticking = false
  }
}

/** Arranca el loop una sola vez por proceso. Idempotente. */
export function startScheduler(): void {
  if (started) return
  started = true
  setTimeout(() => { void tick() }, FIRST_DELAY_MS)
  setInterval(() => { void tick() }, TICK_MS)
  console.log('[auto-scheduler] iniciado (tick cada 5 min)')
}
