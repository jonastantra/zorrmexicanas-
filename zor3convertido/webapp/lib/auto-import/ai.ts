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

export type AiProvider = 'openrouter' | 'minimax'

// Config por proveedor. Ambos usan una API compatible con OpenAI
// (chat/completions). Las llaves van en variables de entorno.
function providerConfig(provider: AiProvider): { url: string; key: string | undefined; keyName: string } {
  if (provider === 'minimax') {
    const base = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1').replace(/\/$/, '')
    return { url: `${base}/chat/completions`, key: process.env.MINIMAX_API_KEY, keyName: 'MINIMAX_API_KEY' }
  }
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    keyName: 'OPENROUTER_API_KEY',
  }
}

export async function rewriteEditorial(
  input: RewriteInput,
  opts: { model?: string; prompt: string; provider?: AiProvider }
): Promise<RewriteResult> {
  const provider: AiProvider = opts.provider === 'minimax' ? 'minimax' : 'openrouter'
  const cfg = providerConfig(provider)
  if (!cfg.key) throw new OpenRouterError(`${cfg.keyName} no configurado`)

  const model = opts.model || process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct'

  const controller = new AbortController()
  // MiniMax (modelos de razonamiento) puede tardar más: damos 60s.
  const timeout = setTimeout(() => controller.abort(), provider === 'minimax' ? 60000 : 30000)
  let response: Response
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      headers['X-Title'] = process.env.NEXT_PUBLIC_SITE_NAME || 'AutoImport'
    }
    const payload: Record<string, unknown> = {
      model,
      temperature: 0.95,
      // Los modelos de razonamiento de MiniMax consumen tokens "pensando"
      // antes de responder; damos margen para que el JSON final salga completo.
      max_tokens: provider === 'minimax' ? 2000 : 600,
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
    }
    // response_format json_object solo en OpenRouter; MiniMax podría rechazarlo,
    // y de todos modos extraemos el JSON del contenido como respaldo.
    if (provider === 'openrouter') payload.response_format = { type: 'json_object' }

    response = await fetch(cfg.url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify(payload),
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
