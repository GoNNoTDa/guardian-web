# Guardián Web

Extensión de Chrome (Manifest V3) que **avisa cuando una web tiene actividad
extraña o potencialmente dañina**. Es una herramienta **defensiva**: solo
observa el comportamiento del sitio y puntúa el riesgo; nunca bloquea ni
modifica el tráfico.

## Qué detecta

| Capa | Señal | Peso |
|------|-------|------|
| Reputación | Google Safe Browsing (amenaza confirmada) | 100 |
| Reputación | URLhaus (dominio con malware) | 70–100 |
| Reputación | Dominio en el feed local de malware de URLhaus (auto-actualizado cada 12 h, funciona offline) | 90 |
| Reputación | Dominio recién registrado (RDAP, <30 días) | 40 |
| Reputación | Sitio servido desde IP pelada (excluye localhost/privadas) | 35 |
| Reputación | Puerto no estándar | 15 |
| Privacidad | Rastreadores aprendidos heurísticamente (aparecen en 3+ sitios) | 15 |
| Phishing | Robo de tarjeta / skimmer (nº de tarjeta a un tercero, con Luhn) | 90 |
| Scam | Secuestro del navegador (inundación del historial) | 45 |
| Scam | Pantalla completa forzada al entrar | 25 |
| Reputación | Cadena de redirecciones sospechosa | 20 |
| Reputación | TLD con abuso frecuente | 5 |
| Red | Cryptojacking (dominio de minado conocido) | 80 |
| Red | +20 dominios de terceros (tracking intensivo) | 15 |
| DOM | Dominio homógrafo (punycode/cirílico/leet: `g00gle.com`, `аmazon.com`) | 80 |
| DOM | Typosquatting (imita a una marca conocida) | 60 |
| DOM | Contraseña enviada sin cifrar (HTTP) | 50 |
| DOM | Login enviado a otro dominio | 35 |
| DOM | Nombre de marca con otra terminación (`agenciatributaria.com`) | 30 |
| DOM | Texto de estafa / soporte técnico falso | 45 |
| DOM | Iframes ocultos (clickjacking) | 25 |
| Página | Exfiltración de datos del formulario a un tercero | 70 |
| Página | Minado (WebAssembly + muchos workers) | 40 |
| Página | Fingerprinting de canvas | 20 |
| Página | Pide ubicación al entrar | 20 |
| Página | Pide notificaciones al entrar | 15 |
| Descargas | Doble extensión engañosa (`factura.pdf.exe`) | 90 |
| Descargas | Archivo ejecutable (`.exe`, `.scr`, `.hta`…) | 45 |

Se suman los pesos: **≥50 → aviso naranja**, **≥100 → aviso rojo** (umbral
configurable). Los avisos aparecen como **badge** en el icono, **banner** en la
página, **notificación** del sistema y en el **panel lateral**.

## Configuración (página de opciones)

Todo se ajusta desde la **página de opciones** (icono ⚙️ del popup, o clic
derecho en el icono → *Opciones*): modo local, notificaciones, claves de API,
umbrales, qué detectores están activos y gestión de la lista de confianza.
Ya no hay que editar ningún archivo a mano.

## Novedades por versión

**v1.0 (en curso)**
- **7 idiomas** (es, en, ca, fr, it, zh-CN, ja) vía `_locales`; Chrome elige
  automáticamente según el navegador.
- **Blocklist auto-actualizable**: el feed de malware de URLhaus se descarga
  cada 12 h a una copia local; la comprobación funciona offline y no envía
  tus URLs a ningún sitio.
- **Tests end-to-end** (`tests/`, Puppeteer) que recorren el test-lab y
  verifican cada detector; CI en GitHub Actions.
- Licencia MIT, política de privacidad (`PRIVACY.md`), guía de contribución
  (`CONTRIBUTING.md`), script de empaquetado (`scripts/build.ps1`) y
  documentación de publicación (`store/`).

**v0.3**
- **Página de opciones** completa (activar/desactivar cada detector, umbrales,
  claves, whitelist).
- **Modo local**: desactiva toda consulta a servicios externos; las URLs que
  visitas no salen de tu equipo.
- **Exfiltración de formularios**: avisa si datos que escribes (email, DNI,
  tarjeta, contraseña) viajan hacia un dominio distinto al de la página.
- **Descargas peligrosas**: detecta ejecutables y doble extensión engañosa.

**v0.2**
- Whitelist personal + ~120 dominios de confianza embebidos (menos falsos
  positivos).
- Homógrafos (punycode/confusables/leet) y marcas españolas ampliadas.
- Historial persistente, panel lateral anclado, notificaciones del sistema.
- Estado resistente a la muerte del service worker (MV3).

## Instalación

1. Abre `chrome://extensions`.
2. Activa el **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona esta carpeta.
4. Fija el icono para ver el badge de riesgo por pestaña.

## Claves de API (opcional pero recomendado)

Sin claves la extensión funciona solo con heurísticas locales. Para activar la
reputación en tiempo real, ponlas en la **página de opciones**:

- **Google Safe Browsing**: clave gratuita en Google Cloud Console (habilita la
  *Safe Browsing API*).
- **URLhaus (abuse.ch)**: `Auth-Key` gratuito en <https://auth.abuse.ch/>.

## Privacidad

Con las APIs de reputación activas, la URL de cada página que visitas se
consulta contra Google Safe Browsing y/o URLhaus. Si prefieres que **nada** salga
de tu equipo, activa el **modo local** en las opciones: la extensión seguirá
funcionando solo con las heurísticas locales. Los datos de formularios que
vigila el detector de exfiltración **nunca se almacenan ni se envían**: se
comparan en memoria dentro de la propia página.

## Límites (léelos)

- **No sustituye a un antivirus**: solo ve lo que ocurre dentro del navegador.
- **Falsos positivos**: calibra pesos/umbrales y usa "Confiar en este sitio".
- **Las listas locales envejecen**: los dominios maliciosos rotan en horas; las
  APIs de reputación cubren ese hueco.
- **Manifest V3**: `webRequest` se usa en modo observación (no bloquea).

## Probarla

En `test-lab/` hay un laboratorio local e inofensivo: `node server.js` y abre
<http://127.0.0.1:8000>. Cada página dispara un detector concreto. Ver
`test-lab/README.md`.

## Empaquetar para la Web Store

```
pwsh scripts/build.ps1
```

Genera `dist/guardian-web-vX.Y.Z.zip` solo con lo necesario (sin test-lab ni
docs).

## Licencia

MIT — ver `LICENSE`. Política de privacidad en `PRIVACY.md`. ¿Quieres
contribuir? Lee `CONTRIBUTING.md`.

## Estructura

```
manifest.json
src/
  background.js     Service worker: red, reputación, descargas, orquestación
  content.js        DOM: homógrafos, formularios, scams, exfil (recogida) + banner
  page-probe.js     Mundo MAIN: fingerprinting, minado, permisos, exfiltración
  settings.js       Ajustes (storage) + mapa de detectores
  lib/
    reputation.js   Google Safe Browsing + URLhaus
    scoring.js      Suma de pesos y nivel de riesgo
    blocklists.js   Dominios de minado y TLDs de riesgo
    trusted.js      Dominios de confianza embebidos
ui/
  popup.*           Vista rápida de la pestaña activa
  panel.*           Panel lateral anclado, en vivo
  options.*         Página de configuración
  render.js         Lógica de UI compartida popup/panel
icons/              16 / 48 / 128 px
test-lab/           Laboratorio de pruebas local
```
