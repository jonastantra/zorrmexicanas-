# Decisiones

## D-001 — Estado local

SQLite almacena trabajos, checkpoints, errores y miembros de archivos. Evita conservar inventarios grandes en memoria y permite reanudar.

## D-002 — Configuración

Se usa TOML porque Python 3.12 lo lee sin dependencias externas. Los límites iniciales son cuatro workers, dos operaciones pesadas, lotes de 1,000 y objetivo de memoria inferior a 8 GiB.

## D-003 — Base WordPress

Docker, Podman y MariaDB no están disponibles. La primera auditoría usa un lector SQL incremental. La importación relacional queda aplazada hasta disponer de un servidor local aislado.

## D-004 — Archivos comprimidos

Los manifiestos se generan con `tarfile` sin extracción. Solo el tema pequeño se extrae, validando rutas y rechazando sobrescrituras distintas.

## D-005 — Reserva de disco

No se autoriza una extracción si su tamaño estimado supera el 70% del espacio libre medido al inicio.

