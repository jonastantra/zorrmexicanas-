'use client'

import { useState } from 'react'

type Block = {
  block_key: string
  title: string
  block_type: string
  item_limit: number
  position: number
  enabled: number
}

export default function BlocksForm({ initial }: { initial: Block[] }) {
  const [blocks, setBlocks] = useState(initial)
  const [message, setMessage] = useState('')
  const update = (index: number, patch: Partial<Block>) =>
    setBlocks(items => items.map((item, i) => i === index ? { ...item, ...patch } : item))

  async function save() {
    setMessage('Guardando…')
    const response = await fetch('/api/admin/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    setMessage(response.ok ? 'Bloques guardados.' : 'No se pudieron guardar.')
  }

  return (
    <div>
      {blocks.map((block, index) => (
        <section className="admin-editor" key={block.block_key}>
          <label className="admin-switch">
            <input type="checkbox" checked={Boolean(block.enabled)} onChange={e => update(index, { enabled: e.target.checked ? 1 : 0 })} />
            <strong>{block.title}</strong><code>{block.block_key}</code>
          </label>
          <div className="admin-fields">
            <label>Título<input value={block.title} onChange={e => update(index, { title: e.target.value })} /></label>
            <label>Tipo<select value={block.block_type} onChange={e => update(index, { block_type: e.target.value })}>
              <option value="latest">Recientes</option><option value="popular">Más vistos</option>
              <option value="trending">Tendencias</option><option value="random">Aleatorios</option>
            </select></label>
            <label>Cantidad<input type="number" min="1" max="48" value={block.item_limit} onChange={e => update(index, { item_limit: Number(e.target.value) })} /></label>
            <label>Posición<input type="number" value={block.position} onChange={e => update(index, { position: Number(e.target.value) })} /></label>
          </div>
        </section>
      ))}
      <button className="admin-primary" onClick={save}>Guardar bloques</button>
      {message && <p>{message}</p>}
    </div>
  )
}
