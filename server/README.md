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

Servidor oficial de este proyecto: **https://sec.fourmartech.es**
(configurado por defecto en la extensión, en `src/settings.js` → `communityUrl`).

1. Crea una base de datos MySQL y carga el esquema:
   ```
   mysql -u USUARIO -p BASE < schema.sql
   ```
2. Copia `config.example.php` a `config.php` y rellena credenciales, `pepper`
   (cadena larga aleatoria) y `admin_token`. **`config.php` no se sube al repo.**
3. Sube el contenido de esta carpeta a la **raíz web** del dominio, con PHP 7.4+
   (idealmente 8.x). Comprueba que `.htaccess` está activo (AllowOverride).

### Distribución de archivos en el servidor

```
sec.fourmartech.es/
├── config.php            ← lo creas tú (con tus tokens); NO público
├── .htaccess             ← deniega config.php, lib/ y schema.sql
├── schema.sql            ← solo para cargar en MySQL; no se sirve
├── lib/  (db.php, helpers.php)
├── api/
│   ├── report.php        → POST  https://sec.fourmartech.es/api/report.php
│   └── lookup.php        → GET   https://sec.fourmartech.es/api/lookup.php?prefix=abcd
└── admin/
    └── index.php         → GET   https://sec.fourmartech.es/admin/?token=TU_ADMIN_TOKEN
```

### Comprobaciones tras subir

- `GET https://sec.fourmartech.es/api/lookup.php?prefix=0000` debe responder
  `{"prefix":"0000","matches":[]}` (JSON, aunque esté vacío).
- `GET https://sec.fourmartech.es/config.php` debe dar **403** (protegido).
- El panel `/admin/?token=...` debe cargar solo con el token correcto.

### CORS

En `config.php`, `allow_origin`:
- Durante las pruebas: `'*'`.
- En producción, cuando tengas el ID de la extensión publicada:
  `'chrome-extension://TU_ID_DE_EXTENSION'` (solo tu extensión podrá usar la API).

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
