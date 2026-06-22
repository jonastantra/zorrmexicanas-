# Auditoría de entradas duplicadas

Fecha: 2026-06-22

## Resultado

- Registros totales en `posts`: **514,186**
- Publicaciones canónicas antes de la reparación exacta: **22,021**
- Publicaciones canónicas después: **21,917**
- Duplicados exactos adicionales retirados: **104**
- La portada muestra **21,863 videos utilizables** porque también excluye entradas cuyo único embed está muerto.

## Cuándo comenzó

Hay duplicados aislados desde el **21 de junio de 2023**, pero no son todavía la
ráfaga masiva.

La automatización descontrolada empieza durante el **28 de diciembre de 2023**:

| Fecha | Publicados | Duplicados exactos o de alta confianza | Proporción |
|---|---:|---:|---:|
| 2023-12-27 | 749 | 4 | 0.5% |
| 2023-12-28 | 999 | 343 | 34.3% |
| 2023-12-29 | 4,717 | 4,075 | 86.4% |
| 2023-12-30 | 9,029 | 8,415 | 93.2% |
| 2023-12-31 | 11,292 | 10,741 | 95.1% |
| 2024-01-01 | 11,888 | 11,434 | 96.2% |

El primer salto sostenido aparece el **28 de diciembre de 2023 a las 23:00**,
con 388 publicaciones en una hora. Desde el 29 de diciembre el proceso corre
continuamente y aumenta cada hora.

Los picos máximos fueron:

- **7 de febrero de 2024:** 26,949 publicaciones; 98.0% duplicadas.
- **6 de febrero de 2024:** 26,163 publicaciones; 95.1% duplicadas.

## Grupos más repetidos

- `mamada-17`: **1,206** apariciones.
- `blowjob-36`: **751** apariciones.
- `casada infiel`: **553** apariciones.
- `amiga-3`: **487** apariciones.
- Un mismo `videoid=79781409`: **362** apariciones.

## Reparaciones aplicadas

- Los listados consultan únicamente `canonical_posts`.
- La paginación ahora cuenta canónicos, no todos los posts inflados.
- Los contadores de categorías y etiquetas se recalculan usando solo canónicos.
- Se eliminaron 104 duplicados exactos residuales por `videoid`, embed o miniatura.
- Backup previo:
  `_migration_workspace/backups/migration-before-canonical-dedup-20260622-001150.db`
