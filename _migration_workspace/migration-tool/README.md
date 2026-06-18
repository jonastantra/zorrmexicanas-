# WordPress Migration Tool

CLI local, reanudable y de solo lectura para inventariar y auditar las fuentes de la migración.

```powershell
python -m src.cli inventory
python -m src.cli sample --limit 1000
python -m src.cli archive-list --resume
python -m src.cli audit --resume
python -m src.cli status
```

La configuración predeterminada se encuentra en `config.example.toml`. Puede copiarse como `config.toml`.

