# Empaqueta la extensión para la Chrome Web Store.
# Incluye SOLO lo que la extensión necesita (sin test-lab, docs ni git).
# Uso:  pwsh scripts/build.ps1

$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "guardian-web-v$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

$items = @("manifest.json", "src", "ui", "icons") | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $items -DestinationPath $zip

Write-Host "Paquete creado: $zip"
Write-Host "Súbelo en https://chrome.google.com/webstore/devconsole"
