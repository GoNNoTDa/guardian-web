# Hoja de ruta — Guardián Web

Estado y pendientes del proyecto. La versión actual es **v0.6.0**.

## ✅ Hecho

### Núcleo (v0.1–v0.3)
- Arquitectura de 3 capas: red (`background.js`), DOM (`content.js`) y
  comportamiento de página (`page-probe.js`, mundo MAIN).
- Sistema de puntuación con umbrales configurables; badge, banner en página,
  notificación del sistema y panel lateral en vivo.
- Persistencia de estado resistente a MV3 (`chrome.storage.session`).
- Whitelist del usuario + 110 dominios de confianza embebidos (en ellos solo
  avisan las amenazas confirmadas por API, no las heurísticas).
- Página de opciones completa; modo local (sin llamadas externas).
- Historial persistente de avisos.

### Detectores
- Reputación: Google Safe Browsing, URLhaus, feed local auto-actualizable.
- Estructural (local): IP pelada, puerto no estándar, edad de dominio (RDAP).
- Phishing: typosquatting, homógrafos, formularios inseguros, exfiltración,
  skimmer de tarjetas (Luhn).
- Scam: texto de estafa, iframes ocultos, permisos al entrar, browser locker.
- Suplantación de marca con login: la página dice ser un banco u organismo (en
  el título, `og:site_name`, `h1` o el alt del logo) y pide contraseña desde un
  dominio que no es suyo. Mira el CONTENIDO, no el parecido del dominio, que es
  como funcionan de verdad las campañas que avisa el INCIBE. 45 marcas, con
  contexto obligatorio en las de nombre ambiguo (Santander, Correos, Apple).
- Secuestro del portapapeles: compara lo que el usuario tenía seleccionado con
  lo que la web escribe al copiar. Distingue adornar (añadir la fuente, formato
  Markdown) de sustituir, y solo actúa dentro de un evento `copy` real, para que
  un botón «copiar código» no cuente. Si en el cambiazo entra un IBAN o una
  dirección de criptomoneda sube a 70: ahí el objetivo es desviar un pago.
- ClickFix / CAPTCHA falso: vigila lo que la web escribe en el portapapeles
  (`writeText`, evento `copy` y `execCommand`) y reconoce el camuflaje con
  espacios; el señuelo textual («verifica que eres humano» + `Win+R`/`Ctrl+V`)
  se puntúa aparte y por debajo del umbral, para no marcar los artículos que
  explican esta misma estafa.
- Malware/privacidad: cryptojacking, fingerprinting, terceros, rastreadores
  aprendidos (heurístico, sin listas).
- Descargas peligrosas (doble extensión, ejecutables).
- Guardián de resultados de búsqueda, en local, en 6 buscadores: Google (.com y
  .es), Bing, DuckDuckGo, Brave Search y Yahoo.

### Comunidad (v0.6)
- Backend PHP + MySQL: reportes de usuarios, validación por umbral, moderación.
- Consulta con k-anonimato; reporte manual; UUID anónimo hasheado.

### Plataforma
- i18n en 7 idiomas (es, en, ca, fr, it, zh_CN, ja), 173 claves con paridad.
- Enlaces educativos por vector (OSI/INCIBE, OWASP/EFF/MDN).
- Laboratorio local de pruebas manuales (`test-lab/`).
- Licencia MIT, política de privacidad, guía de contribución, script de build.
- Repositorio público en GitHub: https://github.com/GoNNoTDa/guardian-web

### Presencia pública (jul. 2026)
- Sitio web propio en https://sec.fourmartech.es, servido desde `server/`:
  landing y política de privacidad en **español e inglés** con selector de
  idioma. Sin cookies, sin analíticas, sin recursos de terceros.
- README bilingüe con tabla de señales, FAQ y explicación de la arquitectura.
- Material de la Chrome Web Store preparado en `store/`: ficha bilingüe
  (`STORE_LISTING.md`), justificación de permisos, declaraciones de privacidad
  obligatorias, checklist de envío, guía de capturas y los dos tiles
  promocionales (440×280 y 1400×560).

## 🔜 Pendiente — acciones del usuario (no de código)

1. **Rodaje y calibración** (EN CURSO). Usar la extensión a diario, anotar
   falsos positivos y afinar pesos/umbrales. Es el paso más importante antes
   de publicar.
2. **Verificar el backend PHP** al desplegarlo (no se ha podido lintar en local):
   cargar `schema.sql`, configurar `config.php`, probar report/lookup/moderación.
3. **Disparar las capturas** de la ficha siguiendo `store/CAPTURAS.md` y
   guardarlas en `store/screenshots/` (la guía y los tiles ya están hechos;
   faltan las imágenes en sí).
4. **Cuenta de desarrollador** de Chrome (5 USD, pago único) y subir el zip de
   `dist/`. Ojo: `<all_urls>` + servidor de comunidad exigen justificar bien la
   privacidad en la ficha (ya cubierto en `PRIVACY.md` y en
   `store/PERMISSIONS_JUSTIFICATION.md`).

### Criterios para dar el paso de publicar

Para no publicar antes de tiempo, la vara de medir es:

- Dos semanas de uso diario sin ningún falso positivo que dispare banner (≥50)
  en sitios legítimos de uso normal.
- `test-lab/clean.html` en verde y el resto de páginas del laboratorio
  disparando su detector correspondiente.
- Backend de comunidad desplegado y probado de punta a punta (reporte, consulta
  k-anónima y moderación).
- Capturas y ficha revisadas contra `store/SUBMISSION_CHECKLIST.md`.

## 🎯 Detectores contra técnicas de 2025-2026

Del repaso al panorama de amenazas de julio de 2026. **ClickFix**, **marca +
contraseña en dominio ajeno** y **secuestro del portapapeles** ya están hechos
(ver arriba); el resto sigue en pie, en orden de valor por línea de código. Los
pesos son propuestas de partida, a calibrar en el rodaje.

1. **Web3 / wallet drainers** (detector nuevo). Envolver `window.ethereum`:
   `eth_sign` (~70), `setApprovalForAll`/`approve` con `MAX_UINT256` (~70),
   `personal_sign` con `Permit`/`Permit2` (~50) y, sobre todo, petición de
   **frase semilla** en un formulario (~90): eso no lo pide nadie legítimo.
2. **Browser-in-the-Browser** (~70). Contenedor con aspecto de ventana (sombra,
   cabecera, botones de cerrar) que pinta una URL `https://` de otra marca y
   contiene un campo de contraseña. Ninguna web honesta dibuja una barra de
   direcciones.
3. **HTML smuggling** (~50). Envolver `URL.createObjectURL` y detectar
   `<a download>` con `blob:`/`data:` disparado por `.click()` sin gesto del
   usuario. Es el hueco que solo una extensión puede tapar: sin petición de red,
   ni proxy ni reputación de URL ven nada.
4. **SVG con JavaScript** (~45, y ~70 si el documento principal es un SVG con
   formulario de login). Los adjuntos SVG maliciosos se multiplicaron por 50 en
   un año.
5. **Prompt injection oculto** (~40). Texto invisible (`left:-9999px`,
   `font-size:0`, color del fondo) con instrucciones dirigidas a un agente de
   IA. Novedad de 2026; útil para quien navegue con un agente o pegue páginas en
   un chatbot.
6. **Reforzar el aviso de notificaciones** (15 → ~40) cuando la petición llega
   con el señuelo del reproductor falso («pulsa Permitir para ver el vídeo») o
   se registra un service worker en un dominio no confiable.

Descartados a propósito: **AiTM/Evilginx** (la señal fiable es el fingerprint
TLS, invisible desde el navegador; lo que lo frena son las passkeys) y
**quishing** (el QR llega por papel o email, no por la página).

## 💡 Ideas para próximas versiones (código)

- **Calibración del RDAP**: decidir si la edad de dominio queda activada por
  defecto; medir su tasa de falsos positivos en el rodaje.
- **Página interna de "conoce el vector"**: explicaciones propias dentro de la
  extensión en el idioma del usuario, en lugar de (o además de) enlazar fuera.
- **Contador de aprendizaje**: "has visto N intentos de phishing este mes"
  para gamificar la concienciación.
- **Más marcas** en la lista anti-typosquatting según lo que aparezca en el uso.
- **Modernizar SQL**: sustituir `VALUES()` en `ON DUPLICATE KEY` por alias de
  fila (MySQL 8.0.20+).
- **Compatibilidad Firefox** con `webextension-polyfill`, y de ahí a Firefox
  Add-ons y Edge Add-ons (mismo paquete, revisión distinta).
- **Resaltar el elemento** concreto en la página (el iframe/formulario/script),
  no solo describirlo en el banner.
- **Tests sin dependencias**: al retirar Puppeteer nos quedamos sin red de
  seguridad automática. `node:test` (nativo, cero dependencias) sobre las
  funciones puras — `scoring`, `domain`, homógrafos, Luhn, levenshtein — daría
  cobertura barata sin traicionar la regla de «sin dependencias».
- **Exportar / importar ajustes** (JSON): útil para reinstalar, para llevar la
  misma configuración a otro equipo y para preparar demos reproducibles.
- **Documentar el autoalojamiento** del backend de comunidad en `server/README`:
  quien no confíe en el servidor oficial debería poder montar el suyo en cinco
  minutos. Es coherente con el discurso de privacidad y refuerza la candidatura
  a NLnet.
- **Hardening del backend**: rate limiting por UUID e IP, y revisión de la
  moderación antes de que la comunidad crezca.
- **Más idiomas** (pt, de, gl, eu) manteniendo la paridad de claves.
- **Notas de versión** (`CHANGELOG.md`): con la extensión publicada, los
  usuarios deberían poder ver qué cambia en cada actualización, sobre todo si
  toca privacidad o permisos.

## Divulgación (objetivo del proyecto)

- El `test-lab/` es un "museo de amenazas" navegable e inofensivo: ideal para
  demos en vivo, talleres o vídeo.
- Narrativa: seguridad que respeta la privacidad, de código abierto, que
  además enseña, con foco en las estafas que se sufren en España.
- Público al que llegar, por orden de encaje: asociaciones de mayores y
  bibliotecas (el colectivo que más sufre el phishing bancario), profesorado de
  informática y FP, comunidades de software libre y privacidad, y periodismo de
  tecnología en español.
- Pieza pendiente más rentable: un **vídeo corto** recorriendo el `test-lab/`
  con la extensión puesta. Enseña el producto y el problema a la vez, y sirve
  igual para la ficha de la Store, para la web y para una solicitud de ayuda.

## Financiación

Objetivo: no monetizar espiando; sostener el proyecto con patrocinio y ayudas
a software libre. El orden importa — casi todas valoran tracción, así que
**primero publicar + divulgar + conseguir uso real**, luego aplicar.

- **GitHub Sponsors** (activo): https://github.com/sponsors/GoNNoTDa — vía de
  ingresos pequeños a corto plazo.
- **NLnet — NGI Zero Commons Fund** ⭐ (mejor encaje): financia software libre
  de privacidad/seguridad. Hasta 50 k€ (1ª propuesta), solicitud de 1-2 páginas,
  no exige ser empresa, requiere licencia libre (ya cumplimos con MIT).
  Convocatoria general **cerrada hasta después del verano de 2026** — poner
  alerta y aplicar al reabrir. https://nlnet.nl/propose/
- **INCIBE Emprende** (España, +15 M€ en ayudas): orientado a
  emprendedores/startups, no a open source puro. Vía si algún día se
  profesionaliza/monetiza. https://www.incibe.es/emprendimiento
- **Otras internacionales** para valorar: Sovereign Tech Fund, Open Technology
  Fund (OTF), GitHub Secure Open Source Fund, Mozilla MOSS.

Cuando haya ingresos recurrentes, publicar en qué se gastan (dominio, hosting
del backend, cuota de la Store). Un proyecto que pide confianza en materia de
privacidad se la gana también siendo transparente con el dinero.

*Nota: verificar plazos y requisitos en las webs oficiales antes de aplicar;
las convocatorias cambian.*
