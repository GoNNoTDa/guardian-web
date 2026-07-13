# Hoja de ruta — Guardián Web

Estado y pendientes del proyecto. La versión actual es **v0.6.0**.

## ✅ Hecho

### Núcleo (v0.1–v0.3)
- Arquitectura de 3 capas: red (`background.js`), DOM (`content.js`) y
  comportamiento de página (`page-probe.js`, mundo MAIN).
- Sistema de puntuación con umbrales configurables; badge, banner en página,
  notificación del sistema y panel lateral en vivo.
- Persistencia de estado resistente a MV3 (`chrome.storage.session`).
- Whitelist del usuario + ~120 dominios de confianza embebidos.
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
- Guardián de resultados de búsqueda (iconos de riesgo en Google/Bing, local).

### Comunidad (v0.6)
- Backend PHP + MySQL: reportes de usuarios, validación por umbral, moderación.
- Consulta con k-anonimato; reporte manual; UUID anónimo hasheado.

### Plataforma
- i18n en 7 idiomas (es, en, ca, fr, it, zh_CN, ja), 157 claves con paridad.
- Enlaces educativos por vector (OSI/INCIBE, OWASP/EFF/MDN).
- Laboratorio local de pruebas manuales (`test-lab/`).
- Licencia MIT, política de privacidad, guía de contribución, script de build.

## 🔜 Pendiente — acciones del usuario (no de código)

1. **Rodaje y calibración** (EN CURSO). Usar la extensión a diario, anotar
   falsos positivos y afinar pesos/umbrales. Es el paso más importante antes
   de publicar.
2. **Verificar el backend PHP** al desplegarlo (no se ha podido lintar en local):
   cargar `schema.sql`, configurar `config.php`, probar report/lookup/moderación.
3. **Publicar el repo en GitHub**:
   `gh repo create guardian-web --public --source . --push`
4. **Capturas y material** para la ficha de la Store.
5. **Cuenta de desarrollador** de Chrome (5 USD, pago único) y subir el zip de
   `dist/`. Ojo: `<all_urls>` + servidor de comunidad exigen justificar bien la
   privacidad en la ficha (ya cubierto en `PRIVACY.md`).

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
- **Compatibilidad Firefox** con `webextension-polyfill`.
- **Resaltar el elemento** concreto en la página (el iframe/formulario/script),
  no solo describirlo en el banner.

## Divulgación (objetivo del proyecto)

- El `test-lab/` es un "museo de amenazas" navegable e inofensivo: ideal para
  demos en vivo, talleres o vídeo.
- Narrativa: seguridad que respeta la privacidad, de código abierto, que
  además enseña, con foco en las estafas que se sufren en España.

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

*Nota: verificar plazos y requisitos en las webs oficiales antes de aplicar;
las convocatorias cambian.*
