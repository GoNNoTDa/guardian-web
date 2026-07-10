# Guardián Web — Backend de reputación colaborativa

API en PHP + MySQL que recoge reportes de usuarios y publica una lista de
dominios **validados por la comunidad** (X reportes de instalaciones distintas).
La extensión la consulta con **k-anonimato**: envía solo un prefijo del hash del
dominio, así el servidor nunca sabe qué sitio exacto visitas.

## Privacidad por diseño

- El reporte es **manual y explícito** (el usuario pulsa "Reportar"). Nada se
  envía automáticamente al navegar.
- La consulta usa **prefijo de hash** (4 hex). El servidor devuelve todos los
  dominios validados de ese "cubo"; la extensión compara el hash completo en
  local. El servidor no puede saber qué dominio miraste.
- El UUID de instalación se guarda **hasheado con pepper**, nunca en claro.
- No se almacena IP, email ni ningún dato personal.

## Instalación

1. Crea una base de datos MySQL y carga el esquema:
   ```
   mysql -u USUARIO -p BASE < schema.sql
   ```
2. Copia `config.example.php` a `config.php` y rellena credenciales, `pepper`
   (cadena larga aleatoria) y `admin_token`.
3. Sube la carpeta a un hosting con PHP 7.4+ (idealmente 8.x). Comprueba que
   `.htaccess` está activo (mod_headers / AllowOverride).
4. Endpoints resultantes:
   - `POST /api/report.php`
   - `GET  /api/lookup.php?prefix=abcd`
   - `GET  /admin/?token=...` (moderación)

## Contrato de la API

### POST /api/report.php
```json
{ "installId": "uuid-anónimo", "domain": "sitio.com", "score": 120,
  "detectors": ["typosquat", "insecureform"] }
```
Respuesta: `{ "ok": true, "duplicate": false }`
Errores: 400 input, 429 rate_limit, 405 método.

### GET /api/lookup.php?prefix=abcd
```json
{ "prefix": "abcd", "matches": [
  { "h": "<sha256 completo>", "n": 5, "score": 110, "d": ["typosquat"] }
]}
```

## Moderación

`/admin/?token=TU_TOKEN` lista los dominios y permite validar/rechazar a mano.
Un dominio marcado `rejected` no vuelve a validarse automáticamente.

## Ajuste anti-abuso

En `config.php`: `validation_threshold` (reportes para validar) y
`rate_limit_per_day` (reportes por instalación al día). Súbelos si detectas
campañas de reportes falsos.
