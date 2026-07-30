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
  hasheado en el servidor; no se almacena email, cuenta ni dirección IP.
- El servidor oficial de la comunidad es `https://sec.fourmartech.es`. Puedes
  cambiarlo o vaciarlo en las opciones; vacío = función desactivada. En modo
  local tampoco se realiza ninguna consulta.
- **Qué guarda ese servidor**, y nada más: el dominio reportado, la categoría
  del reporte, la fecha y el UUID de instalación hasheado. No guarda URLs
  completas, ni rutas, ni parámetros, ni tu historial, ni ningún dato personal.
- **Puedes autoalojarlo.** El backend está en `server/` (PHP + MySQL, esquema en
  `schema.sql`) bajo la misma licencia MIT: monta tu propia instancia, apúntala
  en las opciones y tus reportes no pasarán por nuestra infraestructura.

## El sitio web

<https://sec.fourmartech.es> aloja la página del proyecto y esta política, y
sirve además la API de comunidad descrita arriba. El sitio **no usa cookies, ni
analíticas, ni fuentes o scripts de terceros**: es HTML y CSS estáticos, así que
visitarlo no genera ningún perfil sobre ti. Como cualquier servidor web, recibe
la dirección IP de las peticiones para poder responderlas; no se cruza con los
datos de la extensión ni se usa para identificar a nadie.

## Tus datos y cómo eliminarlos

No hay cuenta que cancelar porque nunca se crea ninguna. Todo lo que la
extensión guarda vive en tu navegador y está bajo tu control:

- **Historial de avisos**: botón *Borrar* en el popup.
- **Lista de confianza, ajustes y claves de API**: se editan y vacían desde la
  página de opciones.
- **Todo de golpe**: desinstalar la extensión elimina su almacenamiento
  completo, incluido el feed local y el identificador de instalación.
- **Reportes ya enviados a la comunidad**: son afirmaciones sobre un dominio,
  no sobre ti, y se conservan sin más vínculo que el UUID hasheado. Si quieres
  que se retire uno, abre un issue en el repositorio indicando el dominio.

## Lo que Guardián Web NO hace

- No recopila ni vende datos de navegación.
- No usa analíticas ni telemetría de ningún tipo.
- No inyecta publicidad ni modifica el contenido de las páginas (salvo el
  banner de aviso).
- No crea cuentas ni pide registro: no hay email, nombre ni perfil que asociar
  a ti.
- No descarga ni ejecuta código remoto: todo el JavaScript que se ejecuta es el
  que viene en el paquete de la extensión.
- **No envía nada a ningún servidor con la configuración por defecto y sin
  claves de API.** Recién instalada y sin configurar, Guardián Web funciona
  íntegramente en tu equipo.

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

## Permisos que NO solicita

Tan importante como lo que pide es lo que no pide. Guardián Web **no** declara
`cookies`, `history`, `bookmarks`, `clipboardRead`, `identity`, `management`,
`proxy`, `debugger` ni `nativeMessaging`. No puede leer tus cookies de sesión,
tu historial de navegación, tus marcadores ni tu portapapeles, ni hablar con
programas de tu equipo: técnicamente no tiene acceso a nada de eso. La lista
completa y comprobable está en `manifest.json`.

## Cambios en esta política

Cualquier cambio se publica en el repositorio (el historial de git de este
fichero es el registro completo de versiones) y en
<https://sec.fourmartech.es/privacidad.html>. Si alguna vez un cambio afectara a
qué datos salen de tu equipo, se anunciaría en las notas de la versión
correspondiente.
