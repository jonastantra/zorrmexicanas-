import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeCsvRows, parseCsv } from '../dist/index.js'

test('lee CSV con descripciones y etiquetas entre comillas', () => {
  const rows = parseCsv('source_id,video_id,title,description,tags,status\nxvideos,7,"Título, nuevo","Línea uno","uno,dos",publish\n')
  assert.equal(rows[0].title, 'Título, nuevo')
  assert.equal(rows[0].tags, 'uno,dos')
})

test('combina metadatos CSV con un resultado encontrado', () => {
  const video = {
    sourceId: 'xvideos', videoId: '7', url: 'https://www.xvideos.com/video.7/demo',
    title: 'Original', duration: 2, thumbnail: 'https://cdn.example/a.jpg',
    embedUrl: 'https://flashservice.xvideos.com/embedframe/7', tags: [],
  }
  const items = mergeCsvRows([video], [{ source_id: 'xvideos', video_id: '7', title: 'Nuevo', description: 'Texto', tags: 'a|b', status: 'draft' }])
  assert.equal(items[0].video, video)
  assert.deepEqual(items[0].tags, ['a', 'b'])
  assert.equal(items[0].description, 'Texto')
})
