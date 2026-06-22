'use client'

import { useState } from 'react'

export default function VideoEditor({ video }: { video: any }) {
  const [form, setForm] = useState(video)
  const [message, setMessage] = useState('')
  const field = (key: string, multiline = false) => {
    const props = { value: form[key] || '', onChange: (e: any) => setForm({ ...form, [key]: e.target.value }) }
    return multiline ? <textarea rows={5} {...props} /> : <input {...props} />
  }
  async function save() {
    setMessage('Guardando…')
    const response = await fetch(`/api/admin/videos/${video.id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form),
    })
    setMessage(response.ok ? 'Video guardado.' : 'No se pudo guardar.')
  }
  return <div className="video-editor">
    <label>Título{field('title')}</label><label>Slug{field('slug')}</label>
    <label>Descripción{field('excerpt', true)}</label><label>Contenido SEO{field('content', true)}</label>
    <label>Iframe / embed{field('embed', true)}</label><label>Enlace original{field('link')}</label>
    <div className="admin-fields"><label>Duración{field('duration')}</label><label>ID proveedor{field('videoId')}</label></div>
    <label>URL de miniatura{field('thumb')}</label>
    <button className="admin-primary" onClick={save}>Guardar cambios</button>{message && <p>{message}</p>}
  </div>
}
