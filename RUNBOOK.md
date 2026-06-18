# Runbook

Ejecutar desde `_migration_workspace/migration-tool`:

```powershell
python -m src.cli inventory
python -m src.cli sample --limit 1000
python -m src.cli archive-list --resume
python -m src.cli audit --resume
python -m src.cli status
python -m unittest discover -s tests -v
```

Todos los comandos aceptan `--dry-run`, `--batch-size`, `--workers` y `--resume`. Los reportes se escriben en `_migration_workspace/reports`; los logs y checkpoints permanecen en el espacio de migración.

Para reiniciar un trabajo sin tocar las fuentes, elimine únicamente su fila/checkpoint en la copia de SQLite después de realizar un respaldo. No borre ni modifique los cuatro archivos originales.

