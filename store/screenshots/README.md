# Capturas para la Store

La Chrome Web Store pide de 1 a 5 capturas de **1280×800** o **640×400** (PNG o
JPEG). Aquí tienes qué capturar y cómo generarlas con el test-lab.

## Preparación

1. `node test-lab/server.js` y carga la extensión en Chrome.
2. Pon la ventana de Chrome a 1280×800 (o recorta luego a ese tamaño).

## Capturas recomendadas

1. **Banner rojo en acción** — abre `danger-combo.html`. Se ve el banner de
   peligro sobre una página; abre "Ver detalles" para mostrar la lista de
   señales. Es la más vendedora.
2. **Panel lateral** — con el panel acoplado a la derecha mostrando varias
   señales con sus pesos.
3. **Página de opciones** — el ⚙️, mostrando el modo local, los detectores y
   los umbrales. Transmite control y transparencia.
4. **Notificación del sistema** — el toast de "descarga peligrosa" o "sitio
   peligroso" (captura de escritorio).
5. **Popup con historial** — el popup mostrando el estado y el historial de
   avisos.

## Consejos

- Usa datos de ejemplo del test-lab (nada real): son inofensivos y reproducibles.
- Mantén un idioma coherente en todas las capturas (el de tu ficha principal).
- Evita mostrar información personal en las barras de marcadores/pestañas.
- Guarda los archivos aquí como `01-banner.png`, `02-panel.png`, etc.
