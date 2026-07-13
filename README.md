# 🛡️ Guardián Web

**The security extension that protects you _without_ spying on you.**

*[English](#english) · [Español](#español)*

---

## English

**Guardián Web detects phishing, skimmers, cryptojacking and scams by their
**behavior** (not by lists), runs in **100% local mode**, and **teaches you**
with every warning.** Open source, 7 languages, with specific protection for
Spanish banks and public services.

> Website: <https://sec.fourmartech.es> · Privacy:
> <https://sec.fourmartech.es/privacidad.html>

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
| Phishing | Password sent unencrypted (HTTP) | 50 |
| Phishing | Login sent to another domain | 35 |
| Phishing | Card theft / skimmer (card number to a third party, Luhn) | 90 |
| Phishing | Form data exfiltration to a third party | 70 |
| Scam | Scam / fake tech-support text | 45 |
| Scam | Browser locker (history flooding) | 45 |
| Scam | Forced fullscreen on entry | 25 |
| Scam | Hidden iframes (clickjacking) | 25 |
| Malware | Cryptojacking (known mining domain / WASM + workers) | 40–80 |
| Privacy | Canvas fingerprinting | 20 |
| Privacy | Excessive third-party domains | 15 |
| Privacy | Heuristically learned trackers (seen on 3+ sites) | 15 |
| Privacy | Permission prompts on entry (location/notifications) | 15–20 |
| Downloads | Deceptive double extension (`invoice.pdf.exe`) | 90 |
| Downloads | Executable file (`.exe`, `.scr`, `.hta`…) | 45 |

Weights add up: **≥50 → orange warning**, **≥100 → red warning** (configurable).
Warnings appear as a **badge** on the icon, an in-page **banner**, a system
**notification** and in the **side panel**.

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
| Phishing | Contraseña enviada sin cifrar (HTTP) | 50 |
| Phishing | Login enviado a otro dominio | 35 |
| Phishing | Robo de tarjeta / skimmer (nº de tarjeta a un tercero, Luhn) | 90 |
| Phishing | Exfiltración de datos del formulario a un tercero | 70 |
| Scam | Texto de estafa / soporte técnico falso | 45 |
| Scam | Secuestro del navegador (inundación del historial) | 45 |
| Scam | Pantalla completa forzada al entrar | 25 |
| Scam | Iframes ocultos (clickjacking) | 25 |
| Malware | Cryptojacking (dominio de minado / WASM + workers) | 40–80 |
| Privacidad | Fingerprinting de canvas | 20 |
| Privacidad | Exceso de dominios de terceros | 15 |
| Privacidad | Rastreadores aprendidos (aparecen en 3+ sitios) | 15 |
| Privacidad | Permisos pedidos al entrar (ubicación/notificaciones) | 15–20 |
| Descargas | Doble extensión engañosa (`factura.pdf.exe`) | 90 |
| Descargas | Archivo ejecutable (`.exe`, `.scr`, `.hta`…) | 45 |

Se suman los pesos: **≥50 → aviso naranja**, **≥100 → aviso rojo**
(configurable). Los avisos aparecen como **badge** en el icono, **banner** en la
página, **notificación** del sistema y en el **panel lateral**.

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
  search-guard.js   Iconos de riesgo en resultados de búsqueda
  settings.js       Ajustes (storage) + mapa de detectores
  lib/              reputation, scoring, blocklists, trusted, blockfeed,
                    domain, trackers, learn, community
ui/
  popup.* panel.* options.*   Interfaces (comparten render.js e i18n.js)
_locales/           7 idiomas (es, en, ca, fr, it, zh_CN, ja)
icons/              16 / 48 / 128 px
test-lab/           Laboratorio de pruebas local (Node)
server/             Backend PHP + MySQL de reputación colaborativa
store/              Ficha para la Chrome Web Store
scripts/build.ps1   Empaquetado para la Web Store
```

## Build

```
pwsh scripts/build.ps1   # → dist/guardian-web-vX.Y.Z.zip
```
