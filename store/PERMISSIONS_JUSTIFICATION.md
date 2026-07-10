# Justificación de permisos (para la revisión de la Web Store)

Google exige justificar cada permiso y el uso de `host_permissions` amplios.
Texto listo para pegar en los campos correspondientes del Dashboard.

| Permiso | Justificación |
|---------|---------------|
| `webRequest` | Observar (solo lectura) las peticiones de la pestaña para detectar dominios de minado, exceso de terceros y cadenas de redirección. No se usa para bloquear ni modificar. |
| `webNavigation` | Saber cuándo se confirma una navegación para reiniciar el análisis por pestaña y comprobar la reputación del dominio principal. |
| `tabs` | Asociar las señales de riesgo a la pestaña correcta y llevar al usuario a la pestaña afectada desde una notificación. |
| `storage` | Guardar en el equipo del usuario sus ajustes, la lista de sitios de confianza, el historial de avisos y la copia local del feed de malware. |
| `notifications` | Avisar mediante una notificación del sistema cuando se detecta un sitio peligroso o una descarga de riesgo, aunque el usuario no esté mirando la pestaña. |
| `sidePanel` | Ofrecer un panel lateral acoplado con el detalle de las señales de la pestaña activa. |
| `downloads` | Detectar descargas potencialmente peligrosas por su nombre (ejecutables, doble extensión engañosa). Solo se inspecciona el nombre y el origen; no se abre ni se modifica el archivo. |
| `alarms` | Programar la actualización periódica (cada 12 h) de la copia local del feed de dominios de malware. |

## host_permissions: `<all_urls>`

**Justificación:** los detectores deben poder analizar cualquier sitio, ya que
precisamente los sitios peligrosos son desconocidos de antemano. Limitar la
extensión a una lista de dominios haría imposible su función (avisar en sitios
nuevos o fraudulentos). El análisis es local y de solo lectura; la extensión no
recopila ni transmite el contenido de las páginas.

## Uso de código remoto

**No.** La extensión no carga ni ejecuta código remoto. Todo el JavaScript va
incluido en el paquete. Las únicas conexiones de red son consultas de
reputación opcionales (Google Safe Browsing y URLhaus) que el usuario puede
desactivar con el "modo local", y la descarga del feed público de URLhaus (una
lista de texto, no código).
