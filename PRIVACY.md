# Política de privacidad — Guardián Web

*Última actualización: octubre de 2026*

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
| Texto que la web escribe en el portapapeles (detectores ClickFix y de secuestro del portapapeles) | Solo memoria de la propia página; se compara con lo que tenías seleccionado | **No. Nunca se almacena ni se transmite** |
| Peticiones de firma de tu cartera de criptomonedas (detector Web3) | Solo memoria de la propia página; se mira el tipo de petición | **No. Nunca se almacenan ni se transmiten** |

## Qué sale de tu equipo

Recién instalada, sin claves de API y sin tocar las opciones, la extensión hace
**solo dos tipos de petición**, y ninguna lleva el dominio que visitas:

- **Feed de URLhaus** (`urlhaus.abuse.ch`): cada 12 horas se descarga una lista
  pública de dominios maliciosos. La petición no incluye ningún dato tuyo; la
  comparación con los sitios que visitas se hace en tu equipo.
- **Consulta a la comunidad** (`sec.fourmartech.es`): en cada navegación a un
  sitio que no está en la lista de confianza se envía un **prefijo de 4
  caracteres del hash** del dominio, nunca el dominio. Ver la sección siguiente.

Solo si tú lo activas:

- **Google Safe Browsing** (si pones tu clave): se envía la URL de cada página
  que visitas a Google para comprobar si está clasificada como amenaza.
- **URLhaus** (si pones tu clave): se envía el dominio de cada página que
  visitas a abuse.ch.
- **Edad del dominio** (detector desactivado por defecto): se envía a
  `rdap.org` el dominio registrable de cada sitio que no está en la lista de
  confianza, para saber cuándo se registró.

**Modo local**: en las opciones puedes activar el modo local, que desactiva
toda comunicación con servicios externos, incluidas las dos peticiones por
defecto. La extensión sigue funcionando con sus heurísticas locales.

## Reputación de la comunidad

Viene activada con el servidor oficial; puedes cambiarlo o vaciarlo en las
opciones:

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
- **Freno contra reportes falsos.** Como cualquiera puede inventarse UUIDs, al
  reportar el servidor guarda también un hash con clave secreta de la **red**
  desde la que llega el reporte (la IP truncada: los tres primeros bloques en
  IPv4, los tres primeros grupos en IPv6). La IP completa no se guarda nunca.
  Sirve para limitar cuántos reportes salen de una misma red y para que un
  dominio solo se valide cuando lo reportan redes distintas. Las consultas no
  guardan nada de esto.
- El servidor oficial de la comunidad es `https://sec.fourmartech.es`. Puedes
  cambiarlo o vaciarlo en las opciones; vacío = función desactivada. En modo
  local tampoco se realiza ninguna consulta.
- **Qué guarda ese servidor**, y nada más: el dominio reportado, la categoría
  del reporte, la fecha, el UUID de instalación hasheado y el hash de la red
  descrito arriba. No guarda URLs
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
- **No envía tu navegación a ningún servidor con la configuración por
  defecto.** Recién instalada, solo descarga el feed público y hace la
  consulta k-anónima a la comunidad, que no revela qué dominio visitas. Con el
  modo local activo no hace ninguna petición.

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
