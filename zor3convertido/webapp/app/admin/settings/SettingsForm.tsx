'use client'

import { useState } from 'react'

type Ad = { slot_key: string; label: string; html: string; enabled: number }

export default function SettingsForm({ ads }: { ads: Ad[] }) {
  const [items, setItems] = useState(ads)
  const [message, setMessage] = useState('')

  async function save() {
    setMessage('Guardando…')
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ads: items }),
    })
    setMessage(response.ok ? 'Configuración guardada.' : 'No se pudo guardar.')
  }

  return (
    <div>
      {items.map((ad, index) => (
        <section className="admin-editor" key={ad.slot_key}>
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={Boolean(ad.enabled)}
              onChange={(e) => setItems(current => current.map((item, i) => i === index ? { ...item, enabled: e.target.checked ? 1 : 0 } : item))}
            />
            <strong>{ad.label}</strong>
            <code>{ad.slot_key}</code>
          </label>
          <textarea
            rows={6}
            value={ad.html}
            placeholder="HTML o código de la red publicitaria"
            onChange={(e) => setItems(current => current.map((item, i) => i === index ? { ...item, html: e.target.value } : item))}
          />
        </section>
      ))}
      <button className="admin-primary" onClick={save}>Guardar publicidad</button>
      {message && <p>{message}</p>}
    </div>
  )
}
