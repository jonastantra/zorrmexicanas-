param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$source = Resolve-Path (Join-Path $PSScriptRoot '..\zor3convertido\webapp')
$target = [System.IO.Path]::GetFullPath($Destination)
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($target.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase) -and $target -eq $workspace) {
  throw 'El destino no puede ser la raíz del proyecto.'
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
$excludeDirectories = @(
  (Join-Path $source 'node_modules'),
  (Join-Path $source '.next'),
  (Join-Path $source 'data'),
  (Join-Path $source 'public\media\thumbs')
)
& robocopy $source $target /E /XD $excludeDirectories /XF '.env.production' '*.tsbuildinfo' | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "Robocopy terminó con código $LASTEXITCODE"
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.env.example') -Destination (Join-Path $target '.env.example')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'site.config.example.ts') -Destination (Join-Path $target 'lib\site.config.example.ts')
Write-Host "Plantilla creada en $target"
