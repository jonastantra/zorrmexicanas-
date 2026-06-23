// Reescritura editorial con OpenRouter para el publicador automático.
// Devuelve título/descripción ya saneados; la validación de calidad se hace aparte.
import { cleanText, deShout } from './sanitize'

export const PROMPT_VERSION = '2026-06-auto-v1'

export interface RewriteInput {
  originalTitle: string
  source: string
  tags?: string[]
  durationMinutes?: number
}

export interface RewriteResult {
  title: string
  description: string
  model: string
}

export class OpenRouterError extends Error {}

export async function rewriteEditorial(
  input: RewriteInput,
  opts: { model?: string; prompt: string }
): Promise<RewriteResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new OpenRouterError('OPENROUTER_API_KEY no configurado')

  const model = opts.model || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Zorritas Mexicanas AutoImport',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.85,
        max_tokens: 600,
        messages: [
          { role: 'system', content: opts.prompt },
          {
            role: 'user',
            content: JSON.stringify({
              originalTitle: input.originalTitle,
              source: input.source,
              tags: input.tags ?? [],
              durationMinutes: input.durationMinutes ?? 0,
              requiredJson: { title: 'string 55-90 chars', description: 'string 230-320 chars' },
            }),
          },
        ],
      }),
    })
  } catch (err) {
    throw new OpenRouterError(
      err instanceof Error && err.name === 'AbortError'
        ? 'OpenRouter timeout'
        : `OpenRouter fetch: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new OpenRouterError(`OpenRouter HTTP ${response.status} ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new OpenRouterError('OpenRouter sin contenido')

  let parsed: { title?: unknown; description?: unknown }
  try {
    parsed = JSON.parse(content)
  } catch {
    // Algunos modelos envuelven el JSON en texto: intentar extraerlo.
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) throw new OpenRouterError('OpenRouter devolvió JSON inválido')
    parsed = JSON.parse(m[0])
  }

  const title = deShout(cleanText(String(parsed.title ?? '')))
  const description = cleanText(String(parsed.description ?? ''))
  if (!title || !description) throw new OpenRouterError('OpenRouter devolvió campos vacíos')

  return { title, description, model }
}
