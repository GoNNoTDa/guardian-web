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
- Malware/privacidad: cryptojacking, fingerprinting, terceros, rastreadores
  aprendidos (heurístico, sin listas).
- Descargas peligrosas (doble extensión, ejecutables).
- Guardián de resultados de búsqueda, en local, en 6 buscadores: Google (.com y
  .es), Bing, DuckDuckGo, Brave Search y Yahoo.

### Comunidad (v0.6)
- Backend PHP + MySQL: reportes de usuarios, validación por umbral, moderación.
- Consulta con k-anonimato; reporte manual; UUID anónimo hasheado.

### Plataforma
- i18n en 7 idiomas (es, en, ca, fr, it, zh_CN, ja), 158 claves con paridad.
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
