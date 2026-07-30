# 🛡️ Guardián Web

**The security extension that protects you _without_ spying on you.**

![version](https://img.shields.io/badge/version-0.6.0-2e7d32)
![license](https://img.shields.io/badge/license-MIT-blue)
![manifest](https://img.shields.io/badge/Manifest-V3-4285f4)
![i18n](https://img.shields.io/badge/i18n-7%20languages-6a1b9a)
![dependencies](https://img.shields.io/badge/dependencies-none-455a64)
![telemetry](https://img.shields.io/badge/telemetry-zero-c62828)

*[English](#english) · [Español](#español)*

---

## English

**Guardián Web detects phishing, skimmers, cryptojacking and scams by their
**behavior** (not by lists), runs in **100% local mode**, and **teaches you**
with every warning.** Open source, 7 languages, with specific protection for
Spanish banks and public services.

> Website: <https://sec.fourmartech.es/index.en.html> · Privacy:
> <https://sec.fourmartech.es/privacy.en.html>

### Philosophy

- **No telemetry.** Your browsing is never collected or sold. Ever.
- **Behavior, not lists.** It analyzes how a site acts, so it catches brand-new
  threats not yet in any database.
- **Local first.** Local mode disables every external query: nothing leaves
  your device.
- **Educational.** Every warning links to material to learn about the threat.
  The best defense is you, knowing how to look.

It's a **defensive** tool: it only observes and scores risk; it never blocks or
modifies traffic. It's not a replacement for an antivirus.

### How it works

Three layers watch the same tab from different vantage points and feed a single
score:

1. **Network** (`background.js`, service worker) — requests, redirect chains,
   reputation lookups, domain age, downloads.
2. **DOM** (`content.js`, isolated world) — the domain name itself, forms,
   scam wording, and the in-page warning banner.
3. **Page behavior** (`page-probe.js`, MAIN world) — what the site's own
   JavaScript tries to do: fingerprinting, mining, form exfiltration, locking
   the browser.

Each signal adds points instead of issuing a verdict on its own. That's
deliberate: single-signal detectors are the ones that cry wolf, and a false
positive spends the user's trust — the only thing this kind of tool really has.

### What it detects

| Layer | Signal | Weight |
|-------|--------|--------|
| Reputation | Google Safe Browsing (confirmed threat) | 100 |
| Reputation | URLhaus (malware domain) | 70–100 |
| Reputation | Community-reported domain (k-anonymous lookup) | 85 |
| Reputation | Domain in the local URLhaus malware feed (auto-updated every 12 h, works offline) | 90 |
| Reputation | Newly registered domain (RDAP, <30 days) | 40 |
| Reputation | Raw-IP hosting (excludes localhost/private) | 35 |
| Reputation | Non-standard port | 15 |
| Reputation | Suspicious redirect chain | 20 |
| Reputation | Frequently abused TLD | 5 |
| Phishing | Homograph domain (punycode/cyrillic/leet: `g00gle.com`) | 80 |
| Phishing | Typosquatting (impersonates a known brand) | 60 |
| Phishing | Known brand under a different TLD (`agenciatributaria.com`) | 30 |
| Phishing | Page claims to be a known brand and asks for a password | 60 |
| Phishing | Fake browser window drawn in the page (browser-in-the-browser) | 70 |
| Phishing | Password sent unencrypted (HTTP) | 50 |
| Phishing | Login sent to another domain | 35 |
| Phishing | Card theft / skimmer (card number to a third party, Luhn) | 90 |
| Phishing | Form data exfiltration to a third party | 70 |
| Scam | Scam / fake tech-support text | 45 |
| Scam | Clipboard hijacking: what you copied is swapped (70 if an account or crypto address is involved) | 45–70 |
| Scam | ClickFix: fake human check asking for `Win+R` / `Ctrl+V` | 45 |
| Scam | System command placed in your clipboard (60 if padded to hide it) | 45–60 |
| Scam | Browser locker (history flooding) | 45 |
| Scam | Forced fullscreen on entry | 25 |
| Scam | Hidden iframes (clickjacking) | 25 |
| Malware | Cryptojacking (known mining domain / WASM + workers) | 40–80 |
| Crypto | Wallet recovery phrase requested in a form | 90 |
| Crypto | `eth_sign` blind signature | 70 |
| Crypto | `setApprovalForAll` over a whole NFT collection | 70 |
| Crypto | Unlimited token spending approval | 70 |
| Crypto | Off-chain `Permit`/`Permit2` spending signature | 50 |
| Privacy | Canvas fingerprinting | 20 |
| Privacy | Excessive third-party domains | 15 |
| Privacy | Heuristically learned trackers (seen on 3+ sites) | 15 |
| Privacy | Permission prompts on entry (location/notifications) | 15–20 |
| Downloads | File built in the browser and downloaded with no user gesture (HTML smuggling) | 45 |
| Downloads | Deceptive double extension (`invoice.pdf.exe`) | 90 |
| Downloads | Executable file (`.exe`, `.scr`, `.hta`…) | 45 |

Weights add up: **≥50 → orange warning**, **≥100 → red warning** (configurable).
Warnings appear as a **badge** on the icon, an in-page **banner**, a system
**notification** and in the **side panel**.

Every signal can be switched off individually from the options page, grouped by
layer. On the ~110 built-in trusted domains, heuristic signals are suppressed
altogether: there, only threats **confirmed** by a reputation API will warn you.

### Search results guard

Before you even click, risk icons appear next to the results on **Google**
(.com and .es), **Bing**, **DuckDuckGo**, **Brave Search** and **Yahoo**. This
runs entirely locally — it only uses what the extension already knows about
those domains, and sends nothing anywhere. Toggle it off in the options.

### Install

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the icon to see the per-tab risk badge.

### Configuration

Everything is set from the **options page** (⚙️ icon in the popup, or
right-click the icon → *Options*): local mode, notifications, API keys,
thresholds, which detectors are active, the community server and the trust list.

### Privacy

With reputation APIs enabled, the URL of each page you visit is checked against
Google Safe Browsing and/or URLhaus. If you prefer that **nothing** leaves your
device, enable **local mode**: the extension keeps working with local
heuristics only. Form data watched by the exfiltration detector is **never
stored or sent** — it's compared in memory inside the page itself. Community
lookups use k-anonymity (only a hash prefix is sent). See `PRIVACY.md`.

### Test it

`test-lab/` is a harmless local lab: run `node server.js` and open
<http://127.0.0.1:8000>. Each page triggers a specific detector.

### FAQ

**Does it work without any API key?** Yes. Without keys it runs on local
heuristics only, which is most of the detectors — and nothing leaves your
device. Keys only add the reputation layer.

**Why does it need access to all sites?** Because the dangerous site is, by
definition, the one nobody has on a list yet. An allowlist of "sites to protect"
would leave you unprotected exactly where it matters. It only reads; it never
modifies (see `PRIVACY.md`).

**Does it slow down browsing?** The detectors are lightweight and observational:
no traffic is intercepted or delayed, and there is no build step or framework
underneath. On trusted domains, most heuristics don't even run.

**Is it a replacement for an antivirus?** No. It watches what a web page does in
your browser. It doesn't scan files or protect the rest of your system.

**Why isn't it in the Chrome Web Store yet?** It's being calibrated in daily use
first — see `ROADMAP.md`. Meanwhile it installs as an unpacked extension.

**Can I use it in a company or a classroom?** Yes, MIT licensed. For a
classroom, `test-lab/` is a walkable "threat museum" for live demos.

### Support the project 💛

Guardián Web is free, open source and non-profit. If you find it useful and want
it to keep growing (more detectors, maintenance, outreach), you can sponsor it:

👉 **[Sponsor on GitHub Sponsors](https://github.com/sponsors/GoNNoTDa)**

### License

MIT — see `LICENSE`. Privacy policy in `PRIVACY.md`. Want to contribute? Read
`CONTRIBUTING.md`.

---

## Español

**Guardián Web detecta phishing, skimmers, cryptojacking y estafas por su
**comportamiento** (no por listas), funciona en modo **100 % local**, y **te
enseña** con cada aviso.** Código abierto, 7 idiomas, con protección específica
para banca y organismos españoles.

> Sitio web: <https://sec.fourmartech.es> · Privacidad:
> <https://sec.fourmartech.es/privacidad.html>

### Filosofía

- **Sin telemetría.** No se recopila ni se vende tu navegación. Nunca.
- **Comportamiento, no listas.** Analiza cómo actúa la web, así detecta
  amenazas nuevas que aún no están fichadas en ninguna base de datos.
- **Local primero.** El modo local desactiva toda consulta externa: nada sale
  de tu equipo.
- **Educativa.** Cada aviso enlaza a material para aprender del vector. La
  mejor defensa eres tú sabiendo mirar.

Es una herramienta **defensiva**: solo observa y puntúa el riesgo; nunca
bloquea ni modifica el tráfico. No sustituye a un antivirus.

### Cómo funciona

Tres capas vigilan la misma pestaña desde sitios distintos y alimentan una sola
puntuación:

1. **Red** (`background.js`, service worker) — peticiones, cadenas de
   redirección, consultas de reputación, edad del dominio, descargas.
2. **DOM** (`content.js`, mundo aislado) — el propio nombre de dominio, los
   formularios, el texto de estafa y el banner de aviso en la página.
3. **Comportamiento de página** (`page-probe.js`, mundo MAIN) — qué intenta
   hacer el JavaScript del sitio: fingerprinting, minado, exfiltración de
   formularios, secuestro del navegador.

Cada señal suma puntos en lugar de dictar un veredicto por sí sola. Es
deliberado: los detectores de señal única son los que gritan «lobo», y un falso
positivo gasta la confianza del usuario, que es lo único que de verdad tiene una
herramienta así.

### Qué detecta

| Capa | Señal | Peso |
|------|-------|------|
| Reputación | Google Safe Browsing (amenaza confirmada) | 100 |
| Reputación | URLhaus (dominio con malware) | 70–100 |
| Reputación | Dominio reportado por la comunidad (consulta k-anónima) | 85 |
| Reputación | Dominio en el feed local de malware de URLhaus (cada 12 h, offline) | 90 |
| Reputación | Dominio recién registrado (RDAP, <30 días) | 40 |
| Reputación | Sitio servido desde IP pelada (excluye localhost/privadas) | 35 |
| Reputación | Puerto no estándar | 15 |
| Reputación | Cadena de redirecciones sospechosa | 20 |
| Reputación | TLD con abuso frecuente | 5 |
| Phishing | Dominio homógrafo (punycode/cirílico/leet: `g00gle.com`) | 80 |
| Phishing | Typosquatting (imita a una marca conocida) | 60 |
| Phishing | Marca conocida bajo otro TLD (`agenciatributaria.com`) | 30 |
| Phishing | La página dice ser una marca conocida y pide contraseña | 60 |
| Phishing | Ventana de navegador falsa dibujada en la página (browser-in-the-browser) | 70 |
| Phishing | Contraseña enviada sin cifrar (HTTP) | 50 |
| Phishing | Login enviado a otro dominio | 35 |
| Phishing | Robo de tarjeta / skimmer (nº de tarjeta a un tercero, Luhn) | 90 |
| Phishing | Exfiltración de datos del formulario a un tercero | 70 |
| Scam | Texto de estafa / soporte técnico falso | 45 |
| Scam | Secuestro del portapapeles: te cambian lo copiado (70 si hay IBAN o dirección de cripto) | 45–70 |
| Scam | ClickFix: falsa verificación humana que pide `Win+R` / `Ctrl+V` | 45 |
| Scam | Comando del sistema copiado a tu portapapeles (60 si va camuflado) | 45–60 |
| Scam | Secuestro del navegador (inundación del historial) | 45 |
| Scam | Pantalla completa forzada al entrar | 25 |
| Scam | Iframes ocultos (clickjacking) | 25 |
| Malware | Cryptojacking (dominio de minado / WASM + workers) | 40–80 |
| Cripto | Frase de recuperación de la cartera pedida en un formulario | 90 |
| Cripto | Firma a ciegas con `eth_sign` | 70 |
| Cripto | `setApprovalForAll` sobre una colección entera de NFT | 70 |
| Cripto | Aprobación de gasto ilimitado de tokens | 70 |
| Cripto | Firma de gasto `Permit`/`Permit2` fuera de cadena | 50 |
| Privacidad | Fingerprinting de canvas | 20 |
| Privacidad | Exceso de dominios de terceros | 15 |
| Privacidad | Rastreadores aprendidos (aparecen en 3+ sitios) | 15 |
| Privacidad | Permisos pedidos al entrar (ubicación/notificaciones) | 15–20 |
| Descargas | Fichero fabricado en el navegador y descargado sin gesto del usuario (HTML smuggling) | 45 |
| Descargas | Doble extensión engañosa (`factura.pdf.exe`) | 90 |
| Descargas | Archivo ejecutable (`.exe`, `.scr`, `.hta`…) | 45 |

Se suman los pesos: **≥50 → aviso naranja**, **≥100 → aviso rojo**
(configurable). Los avisos aparecen como **badge** en el icono, **banner** en la
página, **notificación** del sistema y en el **panel lateral**.

Cada señal se puede desactivar por separado desde la página de opciones,
agrupadas por capa. En los ~110 dominios de confianza que vienen embebidos las
señales heurísticas se suprimen por completo: allí solo avisan las amenazas
**confirmadas** por una API de reputación.

### Guardián de resultados de búsqueda

Antes incluso de hacer clic, aparecen iconos de riesgo junto a los resultados de
**Google** (.com y .es), **Bing**, **DuckDuckGo**, **Brave Search** y **Yahoo**.
Funciona en local: solo usa lo que la extensión ya sabe de esos dominios y no
envía nada a ninguna parte. Se puede desactivar en las opciones.

### Instalación

1. Abre `chrome://extensions`.
2. Activa el **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona esta carpeta.
4. Fija el icono para ver el badge de riesgo por pestaña.

### Configuración

Todo se ajusta desde la **página de opciones** (icono ⚙️ del popup, o clic
derecho en el icono → *Opciones*): modo local, notificaciones, claves de API,
umbrales, qué detectores están activos, el servidor de comunidad y la lista de
confianza.

### Privacidad

Con las APIs de reputación activas, la URL de cada página que visitas se
consulta contra Google Safe Browsing y/o URLhaus. Si prefieres que **nada**
salga de tu equipo, activa el **modo local**: la extensión seguirá funcionando
solo con las heurísticas locales. Los datos de formularios que vigila el
detector de exfiltración **nunca se almacenan ni se envían**: se comparan en
memoria dentro de la propia página. Las consultas de comunidad usan k-anonimato
(solo se envía un prefijo de hash). Ver `PRIVACY.md`.

### Probarla

En `test-lab/` hay un laboratorio local e inofensivo: `node server.js` y abre
<http://127.0.0.1:8000>. Cada página dispara un detector concreto.

### Preguntas frecuentes

**¿Funciona sin claves de API?** Sí. Sin claves funciona solo con heurísticas
locales, que son la mayoría de los detectores, y nada sale de tu equipo. Las
claves únicamente añaden la capa de reputación.

**¿Por qué necesita acceso a todos los sitios?** Porque el sitio peligroso es,
por definición, el que todavía no está en ninguna lista. Una lista de «sitios a
proteger» te dejaría sin protección justo donde importa. Solo lee; nunca
modifica (ver `PRIVACY.md`).

**¿Ralentiza la navegación?** Los detectores son ligeros y de observación: no se
intercepta ni se retrasa ninguna petición, y no hay build ni framework debajo.
En los dominios de confianza la mayoría de heurísticas ni se ejecutan.

**¿Sustituye a un antivirus?** No. Vigila lo que hace una página web dentro de
tu navegador. No escanea ficheros ni protege el resto de tu sistema.

**¿Por qué no está aún en la Chrome Web Store?** Porque primero se está
calibrando con uso diario, ver `ROADMAP.md`. Mientras tanto se instala como
extensión descomprimida.

**¿Puedo usarla en una empresa o en clase?** Sí, licencia MIT. Para clase,
`test-lab/` es un «museo de amenazas» navegable, ideal para demos en vivo.

### Apoyar el proyecto 💛

Guardián Web es gratis, de código abierto y sin ánimo de lucro. Si te resulta
útil y quieres que siga creciendo (más detectores, mantenimiento, divulgación),
puedes patrocinarlo:

👉 **[Patrocinar en GitHub Sponsors](https://github.com/sponsors/GoNNoTDa)**

### Licencia

MIT — ver `LICENSE`. Política de privacidad en `PRIVACY.md`. ¿Quieres
contribuir? Lee `CONTRIBUTING.md`.

---

## Estructura / Structure

```
manifest.json
src/
  background.js     Service worker: red, reputación, descargas, comunidad
  content.js        DOM: homógrafos, formularios, scams, exfil + banner
  page-probe.js     Mundo MAIN: fingerprinting, minado, exfil, browser locker
  search-guard.js   Iconos de riesgo en 6 buscadores (local)
  settings.js       Ajustes (storage) + mapa de detectores
  lib/              reputation, scoring, blocklists, trusted, blockfeed,
                    domain, trackers, learn, community
ui/
  popup.* panel.* options.*   Interfaces (comparten render.js e i18n.js)
_locales/           7 idiomas (es, en, ca, fr, it, zh_CN, ja) · 192 claves
icons/              16 / 48 / 128 px
test-lab/           Laboratorio de pruebas local (Node)
server/             Sitio web (ES/EN) + backend PHP/MySQL de reputación
                    colaborativa (api/, admin/, schema.sql)
store/              Ficha, capturas, tiles y checklist de la Chrome Web Store
scripts/build.ps1   Empaquetado para la Web Store
.github/FUNDING.yml Patrocinio
```

Sin dependencias, sin build step: lo que está en el repo es exactamente lo que se
ejecuta en el navegador. El `build.ps1` solo empaqueta el zip.

*No dependencies, no build step: what's in the repo is exactly what runs in the
browser — `build.ps1` only zips it up.*

## Build

```
pwsh scripts/build.ps1   # → dist/guardian-web-vX.Y.Z.zip
```
