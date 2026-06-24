'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'zm_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const showWhenAllowed = () => {
      const ageVerified =
        window.localStorage.getItem('zm_age_verified') === '1' ||
        document.cookie.split('; ').some(c => c.startsWith('zm_age_verified=1'))
      // Revisar localStorage Y la cookie: si el navegador bloquea/limpia el
      // localStorage (modo privado, protección de rastreo), la cookie conserva
      // la elección y el banner no vuelve a salir.
      const consent =
        window.localStorage.getItem(STORAGE_KEY) ||
        document.cookie.split('; ').find(c => c.startsWith(`${STORAGE_KEY}=`))?.split('=')[1]
      setVisible(ageVerified && !consent)
    }
    showWhenAllowed()
    window.addEventListener('age-verified', showWhenAllowed)
    return () => window.removeEventListener('age-verified', showWhenAllowed)
  }, [])

  function respond(value: 'accept' | 'decline') {
    try { window.localStorage.setItem(STORAGE_KEY, value) } catch {}
    document.cookie = `zm_cookie_consent=${value}; max-age=${60 * 60 * 24 * 180}; path=/; SameSite=Lax`
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite">
      <p>
        🍪 Usamos cookies propias y de terceros para mejorar tu experiencia, analizar el tráfico y mostrar contenido
        relevante. <a href="#" rel="nofollow" style={{ textDecoration: 'underline' }}>Más información</a>.
      </p>
      <button type="button" className="cookie-accept" onClick={() => respond('accept')}>Aceptar</button>
      <button type="button" className="cookie-decline" onClick={() => respond('decline')}>Solo necesarias</button>
    </div>
  )
}
