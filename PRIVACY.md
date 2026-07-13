# Política de privacidad — Guardián Web

*Última actualización: julio de 2026*

Guardián Web es una extensión **defensiva**: analiza el comportamiento de las
páginas que visitas para avisarte de riesgos. Está diseñada bajo el principio
de mínima recogida de datos.

## Qué datos maneja y dónde

| Dato | Dónde vive | ¿Sale de tu equipo? |
|------|-----------|---------------------|
| Señales de riesgo por pestaña | Memoria + `chrome.storage.session` (se borra al cerrar el navegador) | No |
| Historial de sitios marcados | `chrome.storage.local` (máx. 200 entradas, borrable desde el popup) | No |
| Tu lista de sitios de confianza | `chrome.storage.local` | No |
| Ajustes y claves de API | `chrome.storage.local` | No |
| Copia local del feed de URLhaus | `chrome.storage.local` | No (se descarga, nunca se sube nada) |
| Valores tecleados en campos sensibles (detector de exfiltración) | Solo memoria de la propia página; se comparan localmente | **No. Nunca se almacenan ni se transmiten** |

## Consultas a servicios externos (opcionales)

Si configuras claves de API y NO activas el modo local:

- **Google Safe Browsing**: se envía la URL de cada página que visitas a
  Google para comprobar si está clasificada como amenaza.
- **URLhaus (abuse.ch)**: se envía el dominio de cada página que visitas.
- **Feed de URLhaus**: se descarga periódicamente una lista pública; esta
  descarga no incluye ningún dato tuyo.

**Modo local**: en las opciones puedes activar el modo local, que desactiva
toda comunicación con servicios externos. La extensión sigue funcionando con
sus heurísticas locales.

## Reputación de la comunidad (opcional)

Si configuras un servidor de comunidad en las opciones:

- **Reportar es siempre manual.** Solo se envía un sitio cuando pulsas
  "Reportar este sitio". Nada se envía de forma automática al navegar.
- **La consulta usa k-anonimato.** Para saber si un dominio ha sido validado
  por la comunidad, la extensión envía únicamente un prefijo del hash del
  dominio (no el dominio). El servidor devuelve todos los del "cubo" y la
  comparación final se hace en tu equipo: el servidor no sabe qué dominio
  exacto visitas.
- **Identidad anónima.** Se usa un identificador aleatorio de instalación
  (UUID) solo para evitar reportes duplicados y limitar abusos. Se guarda
  hasheado en el servidor; no se recoge email, cuenta ni IP.
- El servidor oficial de la comunidad es `https://sec.fourmartech.es`. Puedes
  cambiarlo o vaciarlo en las opciones; vacío = función desactivada. En modo
  local tampoco se realiza ninguna consulta.

## Lo que Guardián Web NO hace

- No recopila ni vende datos de navegación.
- No usa analíticas ni telemetría de ningún tipo.
- No inyecta publicidad ni modifica el contenido de las páginas (salvo el
  banner de aviso).
- No tiene servidor propio: no existe infraestructura donde pudieran
  almacenarse tus datos.

## Permisos que solicita y por qué

- `webRequest`, `webNavigation`: observar las peticiones de red de cada
  pestaña para detectar minado, redirecciones y tracking. Solo observación.
- `tabs`: asociar señales a pestañas y enfocar la pestaña desde el aviso.
- `storage`: guardar ajustes, historial y listas en tu equipo.
- `notifications`: avisos del sistema operativo.
- `downloads`: detectar descargas con nombre engañoso o ejecutable.
- `sidePanel`: el panel lateral.
- `alarms`: programar la actualización periódica del feed local.
- `<all_urls>`: los detectores deben funcionar en cualquier sitio; sin esto
  la extensión no podría avisarte precisamente en los sitios desconocidos,
  que son los peligrosos.
