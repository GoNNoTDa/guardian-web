# Contribuir a Guardián Web

¡Gracias por tu interés! Este proyecto acepta issues y pull requests.

## Cómo montar el entorno

1. Clona el repo y carga la carpeta en Chrome: `chrome://extensions` →
   Modo de desarrollador → **Cargar descomprimida**.
2. Arranca el laboratorio de pruebas: `node test-lab/server.js` y abre
   <http://127.0.0.1:8000>. Cada página dispara un detector concreto.

## Reglas de oro

- **Solo observación**: la extensión nunca bloquea ni modifica tráfico o
  contenido (salvo el banner de aviso). Los PRs que rompan esto no se aceptan.
- **Privacidad primero**: ningún dato del usuario sale de su equipo salvo las
  consultas de reputación opcionales ya documentadas en `PRIVACY.md`. Un PR
  que añada telemetría/analíticas será rechazado.
- **Sin dependencias**: JavaScript vanilla, sin build step. Lo que hay en el
  repo es lo que se ejecuta.
- **Todo detector nuevo llega con su página de test-lab** que lo dispara, y
  con su entrada en la tabla del README (señal + peso).
- **Cuidado con los falsos positivos**: los pesos nuevos empiezan bajos. Una
  señal que dispara sola el banner (≥50) necesita justificación.

## Estructura rápida

- `src/background.js` — service worker: red, reputación, descargas, veredictos.
- `src/content.js` — DOM: typosquatting/homógrafos, formularios, scams, banner.
- `src/page-probe.js` — mundo MAIN: fingerprinting, minado, exfiltración.
- `src/settings.js` — ajustes + gate de detectores (`detectorOf`).
- `ui/` — popup, panel lateral, opciones.
- `test-lab/` — laboratorio local de pruebas.

Elegir capa es fácil: si la señal está en la **petición de red** va al
background; si está en el **HTML o el dominio**, en `content.js`; si hay que ver
**qué hace el JavaScript del sitio**, en `page-probe.js` (mundo MAIN).

## Añadir un detector, paso a paso

1. Emite el hallazgo en la capa que le corresponda, con un `id` estable, su
   `weight`, su `category` y textos vía `t()` — **nunca texto literal**.
2. Registra la clave del detector en `DETECTORS` (`src/settings.js`) con su
   grupo, para que aparezca en la página de opciones y se pueda desactivar.
3. Mapea el `id` a esa clave en `ID_TO_DETECTOR`. Si el `id` lleva sufijo
   (`locker:fullscreen`), basta con la parte anterior a los dos puntos.
4. Añade las claves `f<Nombre>Title` / `f<Nombre>Detail` y `det_<clave>` a **los
   7 ficheros** de `_locales/` (deben quedar con el mismo número de claves).
5. Crea su página en `test-lab/` y enlázala desde `test-lab/index.html`.
6. Añade la fila (señal + peso) a las **dos** tablas del README, ES e inglés.

## Añadir un idioma

Copia `_locales/es/messages.json` a `_locales/<código>/messages.json` y traduce
los valores sin tocar las claves. La paridad es obligatoria: los 7 idiomas
tienen hoy 173 claves y `t()` (en `ui/i18n.js`) devuelve **la clave literal**
cuando falta el mensaje, así que un hueco pasa desapercibido en revisión y luego
aparece en la interfaz como `fAlgoTitle`.

## Estilo y commits

- JavaScript vanilla, módulos ES, comillas dobles, punto y coma. Sigue el estilo
  del fichero que tocas, no traigas el tuyo.
- Comentarios en español, explicando el **por qué** (sobre todo si un peso o un
  umbral tiene una razón detrás). Interfaz de usuario, siempre vía `_locales`.
- Mensajes de commit **en inglés**, en imperativo y sin prefijos de tipo:
  «Add detector for X», «Fix false positive in Y». (Los commits anteriores a
  julio de 2026 están en español; el proyecto se estandariza en inglés.)

## Antes de abrir el PR

- `node --check` sobre los ficheros tocados (no hay más toolchain).
- Pasa la batería del test-lab, incluida `clean.html` (control de falsos
  positivos).
- Comprueba la paridad de claves entre los 7 idiomas si has tocado `_locales/`.
- Si tocas el manifest o los permisos, explica el porqué en la descripción, y
  actualiza también la lista de permisos de `PRIVACY.md`: es la que se usa para
  justificar la extensión ante la Chrome Web Store.

## Reportar una vulnerabilidad

Si encuentras un fallo de seguridad **en la propia extensión**, no abras un issue
público: escribe a través del perfil de GitHub del mantenedor
([@GoNNoTDa](https://github.com/GoNNoTDa)) y se coordinará el arreglo antes de
hacerlo público. Para falsos positivos o webs maliciosas no detectadas, un issue
normal es lo correcto.
