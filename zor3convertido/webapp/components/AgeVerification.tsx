'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'zm_age_verified'
const COOKIE_KEY = 'zm_age_verified'

export default function AgeVerification() {
  // Render the gate in the initial HTML so it can paint immediately. A tiny
  // head script adds `age-verified` before first paint for returning visitors.
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Check both localStorage and cookie (cookie works across subdomains / strict storage)
    const fromStorage = typeof window !== 'undefined' && (
      window.localStorage.getItem(STORAGE_KEY) === '1' ||
      document.cookie.split('; ').some(c => c.startsWith(`${COOKIE_KEY}=1`))
    )
    setVisible(!fromStorage)
  }, [])

  function accept() {
    try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
    document.cookie = `${COOKIE_KEY}=1; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`
    document.documentElement.classList.add('age-verified')
    window.dispatchEvent(new Event('age-verified'))
    setVisible(false)
  }

  function leave() {
    window.location.href = 'https://www.google.com'
  }

  if (!visible) return null

  return (
    <div className="age-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="age-modal-title">
      <div className="age-modal">
        <div className="age-modal-icon" aria-hidden>🔞</div>
        <h2 id="age-modal-title">¿Eres mayor de 18 años?</h2>
        <p>
          Este sitio web contiene material para adultos. Para continuar, debés confirmar que sos mayor de edad y que
          la ley de tu país te permite acceder a este tipo de contenido.
        </p>
        <div className="age-modal-buttons">
          <button type="button" className="age-modal-btn enter" onClick={accept} autoFocus>
            Sí, soy mayor de 18
          </button>
          <button type="button" className="age-modal-btn leave" onClick={leave}>
            Salir del sitio
          </button>
        </div>
        <p className="age-modal-disclaimer">
          Este sitio usa cookies propias y de terceros. Al continuar aceptás nuestra política de cookies.
          <br />
          Cumplimos con 18 U.S.C. 2257 — todas las modelos son mayores de 18 años.
        </p>
      </div>
    </div>
  )
}
