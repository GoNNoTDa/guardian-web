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

> ⚠️ **Cuidado con la barra de direcciones.** Las páginas de prueba se sirven
> desde `127.0.0.1:8000`, y una ficha cuyas capturas muestran `localhost` resta
> credibilidad. Encuadra **por debajo** de la barra de direcciones siempre que
> puedas, o recórtala después. La excepción es la captura del panel lateral,
> donde interesa que se vea la ventana completa: ahí conviene tener la pestaña en
> una web real de aspecto neutro.

---

## Captura 1 — El banner de peligro (la más importante)

**Cómo:** abre <http://127.0.0.1:8000/brand-login.html>. Salta el banner rojo con
«Esta página dice ser CaixaBank». Pulsa "Ver detalles" para desplegar la lista de
señales con los enlaces "Aprende sobre esto".

**Por qué esta y no otra:** el banner muestra la señal de más peso, y «esta página
dice ser tu banco» se entiende en un segundo sin saber nada de seguridad. Es el
fraude que sufre de verdad el público al que va dirigida la extensión. La
alternativa clásica, `danger-combo.html` (175 puntos, «su ordenador está
infectado»), suma más puntos pero comunica peor: se parece a los propios anuncios
de estafa.

**Encuadre:** la parte superior de la página con el banner desplegado, sin la
barra de direcciones.

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

**Encuadre:** la página de opciones desde arriba (privacidad + detectores). Con
31 detectores repartidos en 7 grupos, la lista completa luce por sí sola: baja lo
justo para que se vean varios grupos distintos y se entienda que todo es
desactivable uno a uno.

**Pie (ES):** Tú mandas: modo 100 % local, cada detector y cada umbral, a tu gusto.
**Caption (EN):** You're in control: 100% local mode, every detector and threshold.

---

## Captura 5 — Las amenazas de 2026 (recomendada)

**Cómo:** abre <http://127.0.0.1:8000/clickfix.html> y pulsa *Copiar (con relleno
de espacios)*. Banner rojo con «Comando oculto en el portapapeles». Despliega los
detalles para que se lea la explicación.

**Por qué:** es el argumento que ninguna extensión de la Store está contando
todavía. Sirve igual la frase de recuperación de `web3-drainer.html` («Te pide la
frase de recuperación», 90) si prefieres apuntar al público cripto.

**Encuadre:** banner desplegado, sin la barra de direcciones.

**Pie (ES):** Detecta las estafas de ahora: el falso CAPTCHA que te hace pegar un comando, el cambiazo del portapapeles, los drenadores de carteras.
**Caption (EN):** Catches today's scams: the fake CAPTCHA that makes you paste a command, clipboard swaps, wallet drainers.

---

## Captura 6 — Iconos de riesgo en el buscador (opcional, la más difícil)

**Cómo:** requiere un dominio ya marcado, y eso no se provoca a voluntad. Las dos
vías: reportar un dominio de prueba a tu servidor de comunidad hasta validarlo
(o bajar `validation_threshold` a 1 temporalmente), o capturar el detector de
homógrafos actuando (`test-lab/homograph.html`, que pide editar el fichero
`hosts`).

**Si no sale con naturalidad, sáltala.** La Store admite de 1 a 5 capturas y ya
hay cinco buenas sin ella; una captura forzada se nota.

**Encuadre:** resultados de búsqueda con el icono ⚠️/🛑 junto a un enlace.

**Pie (ES):** Marca los enlaces peligrosos en Google, Bing, DuckDuckGo, Brave y Yahoo, antes de que hagas clic.
**Caption (EN):** Flags dangerous links on Google, Bing, DuckDuckGo, Brave and Yahoo, before you click.

---

## Imágenes promocionales (opcionales pero recomendadas)

- **Mosaico pequeño:** 440×280. Un fondo verde de marca, el escudo 🛡️, el
  nombre "Guardián Web" y el lema "Seguridad que no te espía".
- **Marquee:** 1400×560. Igual, más ancho, para destacados de la Store.

## Orden recomendado en la ficha

1 (banner de marca suplantada) → 5 (amenazas de 2026) → 2 (popup) → 4 (opciones)
→ 3 (panel lateral). La primera es la que más convierte: que sea el banner rojo
en acción, y que se entienda sin leer.

Si haces la 6 (buscador), va al final y desplaza al panel lateral: cinco es el
máximo.

## Guardado

- En `store/screenshots/`, con nombres que digan el orden y el contenido:
  `1-banner-marca.png`, `2-popup.png`, `3-panel.png`, `4-opciones.png`,
  `5-clickfix.png`.
- **1280×800** exactos. Si recortas a mano y queda a 1279 o 1281, la Store lo
  reescala y se ve borroso: mejor recortar generoso y ajustar el lienzo después.
- PNG. Nada de capturas con la barra de marcadores, notificaciones del sistema
  ni pestañas personales a la vista.
