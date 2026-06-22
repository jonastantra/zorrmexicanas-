# HANDOFF — zorritasmexicanas (migración WordPress → Next.js)

> Documento de continuidad. Si llegas aquí sin contexto previo, léelo entero antes
> de tocar nada. Contiene de dónde venimos, qué se hizo, qué falta, qué reglas no se
> pueden romper y cómo correr todo. Última actualización: **2026-06-21 22:30 CST**.

---

## 1. ¿Qué es este proyecto?

Migración completa del sitio WordPress **zorritasmexicanas.com** a un stack moderno
**Next.js 16 + TypeScript + SQLite (better-sqlite3) + Tailwind**, conservando:

- URLs originales (slugs) — **22,021 canónicos** + 6,262 redirects 301
- Contenido válido (miniaturas vía CDN externo)
- Embeds autorizados (xvideos, pornhub, redtube, xhamster, youporn, youtube)
- Señales SEO (Rank Math meta + JSON-LD VideoObject)

**Reglas duras** (no negociables, vienen de `MIGRATION_PLAN.md` y `DECISIONS.md`):

1. Los 4 archivos originales son **de solo lectura**.
2. **No se elimina contenido** — los descartes van a cuarentena primero.
3. Los procesos largos escriben checkpoints en SQLite y admiten `--resume`.
4. Los reportes extensos van a CSV/JSONL; los `.md` son solo resúmenes.
5. **No se descargan ni re-hospedan videos externos.** Solo se referencian embeds.
6. **No se scrapea** contenido de terceros para sustituir entradas.

---

## 2. Workspace y rutas clave

```
C:\Users\retro\OneDrive\Documentos\zorritasmexicanas\
├── PROJECT_STATUS.md              ← estado del proyecto
├── DECISIONS.md                   ← decisiones técnicas (D-001..D-012)
├── MIGRATION_PLAN.md              ← plan maestro
├── RUNBOOK.md                     ← comandos CLI del migration-tool
├── HANDOFF.md                     ← ESTE ARCHIVO
├── DEPLOYMENT_PLAN.md             ← pasos para llevar a producción
├── DATA_VALIDATION_REPORT.md      ← validación cuantitativa
├── MEDIA_DEDUPLICATION_REPORT.md  ← deduplicación de medios
├── EMBED_VALIDATION_REPORT.md     ← validación de embeds
├── SEO_MIGRATION_REPORT.md        ← estrategia SEO
├── kingtube.tar.gz                ← archivo de medios (parcialmente perdido)
├── gxvcqtpl_zorritasmexicanaclon.sql  ← dump SQL de MariaDB (514,187 filas)
├── zorritasmexicanascom.WordPress.2026-06-18.xml  ← export WXR
├── zor3convertido\
│   └── webapp\                    ← Next.js 16 (el sitio nuevo)
│       ├── middleware.ts          ← carga redirects.data.json
│       ├── redirects.data.json    ← 6,262 redirects (788 KB)
│       └── ...
└── _migration_workspace\          ← CANÓNICO: trabajo serio
    ├── migration.db               ← ★ SQLite, 1.04 GB
    ├── migration.sqlite3          ← state DB (scan_jobs, checkpoints)
    ├── migration-tool\            ← CLI en Python
    ├── reports\                   ← CSVs y resúmenes
    │   ├── canonical-media-map.csv
    │   ├── proposed-redirects.csv
    │   ├── redirect-embed-summary.md (futuro)
    │   └── ...
    ├── logs\                      ← logs de corridas largas
    ├── backups\                   ← snapshots pre-cambio
    │   └── migration-20260621-0958.db (1.04 GB)
    ├── exports\                   ← JSONL limpios
    │   └── next-redirects.json    ← alimenta el middleware
    ├── quarantine\                ← scraper-module (D-006)
    └── dev-*.log                  ← logs del dev server
```

---

## 3. Lo que está hecho

### ✅ Plan A (2026-06-19)
1. `validate-embeds` — 14,846 URLs únicas, 99.36% OK, 95 dead.
2. `detect-post-duplicates` — 261,263 duplicados (92%) / 14,860 canónicos.
3. `repair-thumbnails` — 230,355 posts ↔ attachments mapeados.

### ✅ Plan B (2026-06-21)
4. `generate-redirects` — **6,262 redirects 301** (de 6,305 iniciales, 43 filtrados por ruido).
5. `consolidate-duplicate-attachments` — **9,717 attachments** apuntando al canónico.
6. `repair-embeds` — **95 embeds muertos** marcados con `embed_status='dead'`.
7. **Polish webapp** — `lib/posts.ts` con JOIN a `canonical_posts` (22,021 visibles),
   `app/[slug]/page.tsx` redirige duplicados al canónico, `sitemap.xml` filtrado.
8. **Middleware** con 6,262 redirects (`redirects.data.json`).
9. **`canonical_posts` table** construida: 22,021 IDs visibles.

### ✅ Reportes y plan de deploy
- `DATA_VALIDATION_REPORT.md`, `MEDIA_DEDUPLICATION_REPORT.md`,
  `EMBED_VALIDATION_REPORT.md`, `SEO_MIGRATION_REPORT.md`,
  `DEPLOYMENT_PLAN.md`, `DECISIONS.md` (D-008…D-012 añadidas).

---

## 4. Lo que falta (cola priorizada)

| # | Tarea | Detalle | Bloqueante |
|---|-------|---------|------------|
| 1 | **Verificar dominio final en `lib/site.ts`** | Cambiar placeholder por el dominio real del propietario | Producción |
| 2 | **Subir sitemap al Search Console** | Tras deploy, validar indexación | Post-deploy |
| 3 | **Resolver 1 post faltante** | 514,186 vs 514,187 en dump original | Auditoría |
| 4 | **Considerar S3/R2** | Si los CDNs externos caen | Contingencia |
| 5 | **Búsqueda full-text FTS5** | SQLite ya lo soporta | UX (nice-to-have) |
| 6 | **Caché CDN para estáticos** | nginx ya configurado en DEPLOYMENT_PLAN | Producción |

---

## 5. Cómo correr el sitio (dev)

```powershell
# Desde C:\Users\retro\OneDrive\Documentos\zorritasmexicanas\zor3convertido\webapp
npm run dev
# → http://localhost:3000
```

Logs: `_migration_workspace/dev-server.log`

URLs para probar:
- `http://localhost:3000/` — homepage
- `http://localhost:3000/young-small-mexican-big-dick` — post canónico
- `http://localhost:3000/young-small-mexican-big-dick-2` — duplicado (301 → canónico)
- `http://localhost:3000/categoria/porno-mexicano` — categoría top con 5,941 posts
- `http://localhost:3000/etiqueta/amateur` — tag popular
- `http://localhost:3000/buscar?q=...` — búsqueda
- `http://localhost:3000/page/2` — paginación
- `http://localhost:3000/sitemap.xml` — sitemap
- `http://localhost:3000/robots.txt` — robots

> Primer hit a una ruta tarda ~30-90s porque Next.js compila bajo demanda.
> Después es instantáneo.

---

## 6. Cómo correr el migration-tool

```powershell
cd "C:\Users\retro\OneDrive\Documentos\zorritasmexicanas\_migration_workspace\migration-tool"

# Estado de los trabajos
python -m src.cli status

# Auditoría y deduplicación
python -m src.cli inventory
python -m src.cli detect-post-duplicates --signatures videoid,embed_url,title_norm,thumb_url
python -m src.cli repair-thumbnails
python -m src.cli validate-embeds --max-workers 8

# Nuevos comandos del Plan B
python -m src.cli generate-redirects                # 6,262 redirects
python -m src.cli consolidate-duplicate-attachments # 9,717 remaps
python -m src.cli repair-embeds                     # marca 95 dead
python -m src.cli export-redirects                  # genera next-redirects.json
python -m src.cli validate-migration                # sanity check

# Después de cambios en `migration.db`, regenerar redirects para el middleware:
Copy-Item "..\exports\next-redirects.json" -Destination "..\..\zor3convertido\webapp\redirects.data.json"
```

Todos los comandos aceptan `--dry-run`, `--batch-size`, `--workers`, `--resume`.

---

## 7. Base de datos (lo importante)

**Ruta:** `C:\Users\retro\OneDrive\Documentos\zorritasmexicanas\_migration_workspace\state\migration.db` (1.04 GB)

### Tablas y conteos (post-migración)

| Tabla                   | Filas        | Propósito                                          |
|-------------------------|--------------|----------------------------------------------------|
| `posts`                 | 514,186      | 283,146 publicados + 231,013 attachments           |
| `post_metadata`         | 2,785,708    | Rank Math, embed, thumb, duration, videoid, views  |
| `term_relationships`    | 2,812,102    | 33 categorías activas + 25,906 tags                |
| `post_duplicate_groups` | 1,066,619    | 4 firmas (videoid, embed_url, thumb_url, title_norm)|
| `canonical_posts`       | 22,021       | ★ IDs visibles en listados (D-008)               |
| `thumbnail_candidates`  | 230,355      | FK → attachment canónico                           |
| `post_media`            | 230,355      | FK → attachment canónico                           |
| `embeds`                | 14,846       | 14,751 OK + 95 dead                                |
| `embed_checks`          | 14,846       | Resultado del HEAD HTTP                            |
| `redirects`             | 6,262        | 301 source → target                                |
| `media_canonical_map`   | 9,717        | remapeo de attachments duplicados                  |

### Top categorías (visibles / total)
- `amateur-mexicano`: 2 / 166,786 (todo duplicado)
- `porno-mexicano`: 5,941 / 18,591
- `porno-amateur`: 2 / 8,687
- `mexicanas`: 281 / 6,868
- `costa-rica`: 389 / 6,422

> **Diagnóstico:** el contenido real único es ~22k posts. El resto es duplicación
> masiva (auto-posteo cada hora). Por eso la mayoría de categorías top tienen
> muy pocos visibles.

---

## 8. Cómo desplegar a producción

Ver `DEPLOYMENT_PLAN.md`. Resumen:

```bash
# En el servidor
nvm install 22 && nvm use 22
cd /home/zorritas/app
npm ci --omit=dev
npm run build
pm2 start npm --name zorritas -- run start
```

No requiere Docker. Reverse proxy con nginx + Let's Encrypt.

---

## 9. Riesgos abiertos (no olvidar)

1. **CDNs externos** (`xvideos-cdn.com`, `phncdn.com`, etc.) son el punto único de
   fallo para las miniaturas. Verificar antes de DNS cut.
2. **1 post faltante** entre dump (514,187) y BD (514,186).
3. **`uploads.tar.gz`** perdido parcialmente. La estrategia de fallback (CDN + dedup)
   sigue siendo viable mientras los CDNs sirvan.
4. **El scraper está en cuarentena** (`_migration_workspace/quarantine/scraper-module/`).
   Cualquier intento de revivir `/admin/*` debe mantener el scraper inerte.
5. **Sesiones se rompen a menudo** — por eso existe este `HANDOFF.md`.

---

## 10. Convenciones del repo

- **Indentación:** 2 espacios (webapp), 4 espacios (Python).
- **TypeScript:** estricto. `tsc --noEmit` limpio.
- **Reportes:** CSVs/JSONL en `_migration_workspace/reports/`, resúmenes `.md` solo
  cuando son para humanos.
- **Nunca `rm`** sin pasar por el trash MCP. Los 4 archivos fuente son sagrados.
- **No tocar `_migration_workspace/quarantine/scraper-module/`** salvo para eliminarlo
  cuando confirmemos que no hace falta.

---

## 11. Decisiones clave (resumen — ver `DECISIONS.md`)

- **D-001**: estado local en SQLite (checkpoints, reanudación).
- **D-002**: configuración TOML, 4 workers, batch 1,000, <8 GiB RAM.
- **D-003**: sin Docker/MariaDB local. Importación relacional vía parser SQL.
- **D-004**: manifiestos con `tarfile`, sin extracción salvo tema.
- **D-005**: rechazo de extracciones que superen 70% del espacio libre.
- **D-006**: scraper a cuarentena, admin inerte.
- **D-007**: SQLite es la base canónica hasta validar PostgreSQL.
- **D-008**: tabla `canonical_posts` (22,021 IDs visibles).
- **D-009**: redirects via middleware + JSON bundle (no `next.config.ts`).
- **D-010**: filtrado de redirects ruidosos (`%`, numéricos, muy cortos).
- **D-011**: repair-embeds sin nuevas requests HTTP.
- **D-012**: embeds muertos ocultos en listados, no redirigidos.

---

## 12. Próxima sesión — checklist sugerido

1. Leer este `HANDOFF.md` entero.
2. Verificar `migration.db` (1.04 GB) presente y `redirects.data.json` (788 KB) presente.
3. Verificar dev server (`netstat -ano | findstr :3000`).
4. Si no está, relanzarlo: `cd webapp && npm run dev`.
5. Decidir con el usuario:
   - ¿Procedemos con el deploy a producción?
   - ¿O re-validamos algo antes (dominio, CDN, sitemap)?
6. **Antes de cualquier cambio destructivo en la DB**, hacer backup:
   ```powershell
   Copy-Item "...\state\migration.db" "...\backups\migration-YYYYMMDD-HHMM.db"
   ```
7. Cualquier comando largo: usar `--dry-run` primero.

---

## 13. Frase para el próximo agente

> El usuario no quiere que le menciones la hora ni le sugieras parar. Trabaja hasta
> que él diga. Si una sesión se rompió, no inventes contexto: lee este archivo.
> Las prioridades del usuario son: deduplicar → reparar embeds → consolidar thumbs
> → polish visual → deploy a producción. No scrapear. No inventar IDs.
> El sitio está **listo para producción**. Solo falta confirmar el dominio final
> con el propietario.
