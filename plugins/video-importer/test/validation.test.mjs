import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUrl, validateVideo } from '../dist/index.js'

const video = {
  sourceId: 'xvideos',
  videoId: '123',
  title: 'Video de prueba',
  url: 'https://www.xvideos.com/video.123/demo',
  duration: 8,
  thumbnail: 'https://cdn.example.com/thumb.jpg',
  embedUrl: 'https://flashservice.xvideos.com/embedframe/123',
  tags: ['demo'],
}

test('valida un resultado correcto', () => {
  assert.deepEqual(validateVideo(video), [])
})

test('rechaza embeds que no pertenecen a la fuente', () => {
  const issues = validateVideo({ ...video, embedUrl: 'https://example.com/embed/123' })
  assert.ok(issues.some((issue) => issue.field === 'embedUrl'))
})

test('normaliza host, hash y slash final', () => {
  assert.equal(normalizeUrl('https://WWW.XVIDEOS.COM/embed/123/#x'), 'https://xvideos.com/embed/123')
})
