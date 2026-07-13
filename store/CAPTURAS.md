# Guía de capturas para la Chrome Web Store

La Store admite de 1 a 5 capturas. **Tamaño: 1280×800** (recomendado) o 640×400,
formato PNG o JPEG. Aquí tienes las 5 sugeridas, cómo provocar cada estado con
el `test-lab` y el pie de foto listo (ES + EN).

## Preparación (para que salgan limpias)

1. Usa un **perfil de Chrome limpio** o al menos oculta la barra de marcadores
   (`Ctrl+Shift+B`).
2. Carga la extensión (`chrome://extensions` → Cargar descomprimida).
3. Arranca el laboratorio: `node test-lab/server.js` → <http://127.0.0.1:8000>.
4. Zoom del navegador al **100 %**.
5. Ventana a ~1280 px de ancho para que la captura salga nítida sin reescalar.
6. Herramienta de recorte: `Win + Shift + S`, o la captura de región del sistema.

---

## Captura 1 — El banner de peligro (la más importante)

**Cómo:** abre <http://127.0.0.1:8000/danger-combo.html>. Salta el banner rojo.
Pulsa "Ver detalles" para desplegar la lista de señales con los enlaces
"Aprende sobre esto".

**Encuadre:** la parte superior de la página con el banner desplegado.

**Pie (ES):** Te avisa en la propia página cuando algo es peligroso — y te explica por qué.
**Caption (EN):** Warns you right on the page when something's dangerous — and explains why.

---

## Captura 2 — El popup con el desglose

**Cómo:** con `danger-combo.html` aún abierta, pulsa el icono de la extensión.
Se abre el popup con el estado, la puntuación y cada señal con su enlace.

**Encuadre:** el popup completo (recórtalo con algo de fondo alrededor).

**Pie (ES):** Cada aviso, desglosado y con un enlace para aprender del vector.
**Caption (EN):** Every warning, broken down, with a link to learn about the threat.

---

## Captura 3 — El panel lateral anclado

**Cómo:** en el popup, pulsa 📌 para abrir el panel lateral. Navega a un par de
páginas del test-lab para que se vea que se actualiza en vivo.

**Encuadre:** navegador con el panel lateral a la derecha visible.

**Pie (ES):** Un panel lateral siempre a la vista, que se actualiza al navegar.
**Caption (EN):** An always-on side panel that updates as you browse.

---

## Captura 4 — La página de opciones

**Cómo:** icono ⚙️ del popup (o clic derecho → Opciones). Muestra el modo local,
los detectores y los umbrales.

**Encuadre:** la página de opciones desde arriba (privacidad + detectores).

**Pie (ES):** Tú mandas: modo 100 % local, cada detector y cada umbral, a tu gusto.
**Caption (EN):** You're in control: 100% local mode, every detector and threshold.

---

## Captura 5 — Iconos de riesgo en el buscador

**Cómo:** requiere un dominio marcado. La forma controlada: reporta un dominio de
prueba a tu servidor de comunidad hasta validarlo, o baja `validation_threshold`
a 1 temporalmente; luego busca en Google algo que muestre ese dominio.
Alternativa sencilla: captura el detector de homógrafos/typosquatting actuando
(ver `test-lab/homograph.html`).

**Encuadre:** resultados de búsqueda con el icono ⚠️/🛑 junto a un enlace.

**Pie (ES):** Marca los enlaces peligrosos en Google y Bing, antes de que hagas clic.
**Caption (EN):** Flags dangerous links on Google and Bing, before you click.

---

## Imágenes promocionales (opcionales pero recomendadas)

- **Mosaico pequeño:** 440×280. Un fondo verde de marca, el escudo 🛡️, el
  nombre "Guardián Web" y el lema "Seguridad que no te espía".
- **Marquee:** 1400×560. Igual, más ancho, para destacados de la Store.

## Orden recomendado en la ficha

1 (banner) → 2 (popup) → 4 (opciones) → 3 (panel) → 5 (buscador). La primera es
la que más convierte: que sea el banner rojo en acción.
