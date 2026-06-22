import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params
  const safeName = path.basename(file)
  const extension = path.extname(safeName).toLowerCase()
  if (safeName !== file || !contentTypes[extension] || !/^\d+\.(?:jpe?g|png|webp|avif|svg)$/i.test(safeName)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const target = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    'public',
    'media',
    'thumbs',
    safeName,
  )
  try {
    const data = await fs.readFile(target)
    return new NextResponse(data, {
      headers: {
        'content-type': contentTypes[extension],
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
