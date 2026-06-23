import type { VideoResult } from './types.js'

export interface RewriteOptions {
  model?: string
  prompt?: string
}

export interface RewrittenMetadata {
  title: string
  description: string
}

export async function rewriteWithOpenRouter(video: VideoResult, options: RewriteOptions = {}): Promise<RewrittenMetadata | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const model = options.model || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-7b-instruct'
  const systemPrompt = options.prompt || process.env.OPENROUTER_PROMPT ||
    'Reescribe títulos y descripciones SEO en español mexicano. Mantén intención adulta, evita menores, evita promesas falsas, no uses emojis, no copies literal el título original.'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Zorritas Mexicanas Importer',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            originalTitle: video.title,
            source: video.sourceId,
            tags: video.tags,
            durationMinutes: video.duration,
            requiredJson: { title: 'string, 45-90 chars', description: 'string, 120-260 chars' },
          }),
        },
      ],
      temperature: 0.7,
      max_tokens: 220,
    }),
  })

  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`)
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) return null

  const parsed = JSON.parse(content) as Partial<RewrittenMetadata>
  const title = String(parsed.title || '').trim()
  const description = String(parsed.description || '').trim()
  if (!title) return null
  return {
    title: title.slice(0, 180),
    description: description.slice(0, 500),
  }
}
