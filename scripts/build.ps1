# Empaqueta la extensión para la Chrome Web Store.
# Incluye SOLO lo que la extensión necesita (sin test-lab, docs ni git).
# Uso:  pwsh scripts/build.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

# Se valida ANTES de tocar el zip anterior: si falta algo, más vale quedarse con
# el paquete que ya había que destruirlo y no poder construir el nuevo.
#
# _locales es OBLIGATORIO: el manifest declara default_locale y usa nombres
# __MSG_*__, así que un paquete sin los catálogos lo rechaza la Store.
$necesarios = @("manifest.json", "src", "ui", "icons", "_locales")
$items = $necesarios | ForEach-Object {
  $ruta = Join-Path $root $_
  if (-not (Test-Path $ruta)) { throw "Falta '$_': el paquete quedaria incompleto." }
  $ruta
}

$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "guardian-web-v$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

Compress-Archive -Path $items -DestinationPath $zip

# Comprobación del paquete ya creado: que estén las piezas y los 7 catálogos de
# idioma. Más vale enterarse aquí que en la revisión de la Store.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivo = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  $entradas = $archivo.Entries.FullName
} finally {
  $archivo.Dispose()
}

$catalogos = ($entradas | Where-Object { $_ -like "_locales/*/messages.json" }).Count
$faltan = $necesarios | Where-Object { $n = $_; -not ($entradas | Where-Object { $_ -eq $n -or $_ -like "$n/*" }) }
if ($faltan) { throw "El zip no contiene: $($faltan -join ', ')" }
if ($catalogos -lt 1) { throw "El zip no lleva ningun catalogo de idioma (_locales/*/messages.json)." }

Write-Host "Paquete creado: $zip"
Write-Host "  $($entradas.Count) ficheros · $catalogos idiomas · v$version"
Write-Host "Subelo en https://chrome.google.com/webstore/devconsole"
