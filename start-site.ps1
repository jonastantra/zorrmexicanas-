$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $root 'zor3convertido\webapp'
$stdout = Join-Path $root '_migration_workspace\prod-stdout.log'
$stderr = Join-Path $root '_migration_workspace\prod-stderr.log'

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host 'El sitio ya está activo en http://localhost:3000'
    exit 0
}

Push-Location $app
try {
    if (-not (Test-Path -LiteralPath '.next\BUILD_ID')) {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Falló el build de producción.' }
    }

    $process = Start-Process `
        -FilePath (Get-Command npm.cmd).Source `
        -ArgumentList @('run', 'start') `
        -WorkingDirectory $app `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        & curl.exe -fsS -o NUL http://localhost:3000/
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Sitio activo en http://localhost:3000 (proceso inicial $($process.Id))"
            exit 0
        }
    }

    throw "El servidor no respondió. Revisa $stderr"
}
finally {
    Pop-Location
}
