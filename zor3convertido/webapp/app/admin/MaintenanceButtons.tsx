'use client'

import { useState } from 'react'

const actions = [
  ['audit', 'Actualizar registro'],
  ['thumbnails', 'Continuar miniaturas'],
  ['repair', 'Reemplazar 5 muertos'],
  ['repair-all', 'Reparar todos'],
] as const

export default function MaintenanceButtons() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  async function run(action: string) {
    setBusy(action)
    setMessage('')
    try {
      const response = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await response.json()
      setMessage(result.message || result.error || 'Listo')
    } catch {
      setMessage('No se pudo iniciar el proceso.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {actions.map(([action, label]) => (
          <button
            key={action}
            disabled={Boolean(busy)}
            onClick={() => run(action)}
            style={{
              border: 0, borderRadius: 8, padding: '10px 14px',
              background: action.startsWith('repair') ? '#b4234d' : '#ff2e63',
              color: '#fff', cursor: 'pointer', fontWeight: 700,
            }}
          >
            {busy === action ? 'Iniciando…' : label}
          </button>
        ))}
      </div>
      {message && <p style={{ color: '#b8f7cf' }}>{message}</p>}
    </div>
  )
}
