#!/usr/bin/env node
import { searchVideos, Publisher, type ImportOptions, type SourceId, type VideoResult } from './index.js'

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'
      args[key] = val
      if (val !== 'true') i++
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs()
  const command = args._?.[0] || (process.argv[2] && process.argv[2].startsWith('--') ? 'search' : process.argv[2])

  if (command === 'help' || args.help) {
    printHelp()
    return
  }

  if (command === 'search') {
    const sourceId = (args.source || args.s) as SourceId
    const keywords = args.keywords || args.k
    const page = parseInt(args.page || '1', 10)
    const minDuration = parseInt(args.duration || '0', 10)
    if (!sourceId || !keywords) {
      console.error('Uso: search --source <id> --keywords <kw> [--page 1] [--duration 0]')
      process.exit(1)
    }
    const videos = await searchVideos({ sourceId, keywords, page, minDuration })
    console.log(JSON.stringify({ count: videos.length, videos }, null, 2))
    return
  }

  if (command === 'import') {
    const dbPath = args.db || process.env.MIGRATION_DB_PATH
    if (!dbPath) {
      console.error('Falta --db <path> o MIGRATION_DB_PATH')
      process.exit(1)
    }
    const sourceId = args.source as SourceId
    const keywords = args.keywords
    const page = parseInt(args.page || '1', 10)
    const minDuration = parseInt(args.duration || '0', 10)
    const status = (args.status as 'publish' | 'draft') || 'draft'
    const category = args.category
    const downloadThumb = args.thumb === 'true'
    const limit = parseInt(args.limit || '0', 10)
    if (!sourceId || !keywords) {
      console.error('Uso: import --source <id> --keywords <kw> --db <path> [--page 1] [--duration 0] [--status draft] [--category slug] [--thumb true] [--limit 0]')
      process.exit(1)
    }
    const videos = await searchVideos({ sourceId, keywords, page, minDuration })
    const toImport = limit > 0 ? videos.slice(0, limit) : videos
    console.log(`Encontrados ${videos.length} videos, importando ${toImport.length}...`)
    const publisher = new Publisher({ dbPath })
    try {
      const opts: ImportOptions = {
        postStatus: status,
        categorySlug: category,
        downloadThumbnail: downloadThumb,
      }
      const result = await publisher.importBatch(toImport, opts)
      console.log(JSON.stringify(result, null, 2))
    } finally {
      publisher.close()
    }
    return
  }

  printHelp()
}

function printHelp(): void {
  console.log(`
@zorritas/video-importer - Buscador e importador de videos

Comandos:
  search   Busca videos en una fuente
  import   Busca e importa videos a la base de datos SQLite

Opciones search:
  --source <id>     xvideos | pornhub | redtube | xhamster | youporn
  --keywords <kw>   Palabras clave de búsqueda
  --page <n>        Número de página (default: 1)
  --duration <min>  Duración mínima en minutos (default: 0)

Opciones import:
  (las mismas que search) más:
  --db <path>            Ruta a migration.db (o env MIGRATION_DB_PATH)
  --status <publish|draft>  Estado del post (default: draft)
  --category <slug>     Slug de categoría a asignar
  --thumb <true|false>   Descargar miniatura (default: false)
  --limit <n>           Máximo a importar (0 = todos)

Ejemplos:
  video-importer search --source xvideos --keywords "mexicana"
  video-importer import --source xvideos --keywords "mexicana" --db /data/migration.db --status draft --thumb true
`)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
