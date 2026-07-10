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

## Antes de abrir el PR

- `node --check` sobre los ficheros tocados (no hay más toolchain).
- Pasa la batería del test-lab, incluida `clean.html` (control de falsos
  positivos).
- Si tocas el manifest o los permisos, explica el porqué en la descripción.
