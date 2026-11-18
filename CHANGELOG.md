# Notas de versión — Guardián Web

Qué cambia en cada versión, contado para quien usa la extensión. Los cambios
que tocan **privacidad o permisos** van siempre los primeros de su versión.

## 0.8.0 — noviembre de 2026

**Privacidad y permisos:** no cambia ningún permiso ni sale ningún dato nuevo de
tu equipo. Se guarda en local una cosa más: un contador mensual de avisos por
tipo de amenaza (sin sitios ni direcciones). La copia de ajustes que puedes
exportar no incluye tus claves de API.

### Detecta más

- **La marca como subdominio.** `bbva.es.verificar-cuenta.top` empieza igual que
  la web del banco, pero el dominio de verdad es `verificar-cuenta.top`. Es el
  truco que mejor funciona en el móvil, donde solo se ve el principio de la
  dirección. Nueva señal (60).
- **Marca + gancho.** `paypal-login.top`, `caixabank-seguro.com`: el nombre de la
  marca junto a «login», «seguro», «clientes»… Nueva señal (30–45), que por sí
  sola no avisa pero suma con cualquier otra.
- **Typosquatting con subdominios.** `secure.paypall.com` no saltaba: el
  subdominio alargaba la comparación. Ahora se compara el dominio registrable.
- **Aviso antes de que cargue la página.** El análisis del nombre del dominio
  se hace al confirmar la navegación, no cuando la página termina de cargar.
- **Exfiltración disfrazada.** Se reconoce el dato aunque viaje en base64 o
  codificado en la URL, y también por un «píxel» (`new Image().src`) o por un
  WebSocket, que es como lo sacan los skimmers de verdad.
- **Descargas con el nombre invertido.** Un carácter invisible (U+202E) hace
  que `factura[U+202E]fdp.exe` se lea «facturaexe.pdf» en el explorador; ahora
  se avisa (90).
- **El guardián de búsquedas** marca los dominios que imitan a una marca.

### Arreglos

- **El skimmer no detectaba tarjetas tecleadas con espacios** (`4111 1111 …`),
  que es como las escribe casi todo el mundo y como las formatean casi todas
  las tiendas. Solo funcionaba con el número todo seguido.
- **El banner se quedaba en naranja** aunque el riesgo subiera después a rojo.
  Ahora se actualiza con cada señal nueva; si lo cerraste en naranja y la cosa
  empeora, vuelve a salir.
- **Se perdían las primeras peticiones de cada página.** Los rastreadores y
  dominios de minado cargados desde el propio HTML llegaban antes de que la
  extensión hubiera preparado el estado de la pestaña y no contaban.
- **El sitio al que ibas contaba como «tercero»** del sitio del que venías.
- **Dos avisos simultáneos** en pestañas distintas podían pisarse y dejar solo
  uno en el historial.
- **`google.fr`, `amazon.de` o `ebay.co.uk` puntuaban** como «marca con otra
  terminación». Las marcas que operan bajo muchos países ya no.
- **El guardián de búsquedas se saltaba** cualquier dominio que contuviera
  «google», «bing» o «yahoo» en el nombre: justo los que las suplantan.
- **«Dejar de confiar»** no tenía efecto hasta la siguiente navegación.
- **`www.ing.es` o `app.dgt.es`** se tomaban por su propio dominio registrable
  (afectaba a la consulta de edad del dominio).
- **Las descripciones en francés e italiano** superaban los 132 caracteres que
  admite la Chrome Web Store: el paquete habría sido rechazado.
- Las etiquetas del guardián de búsquedas salían siempre en español.

### Más fácil de usar

- **Qué hacer.** El banner y el popup ya no dicen solo qué se ha encontrado:
  añaden un consejo según el tipo de amenaza («no escribas tu contraseña aquí;
  entra tecleando tú la dirección»).
- **Resumen del mes** en el popup: cuántas veces te ha avisado y de qué.
- **Exportar e importar ajustes** desde la página de opciones.

### Más ligera

- En páginas que cambian sin parar (un chat, un feed) el análisis se espacia en
  lugar de repetirse cada segundo y medio, y no se ejecuta en pestañas en
  segundo plano. Cada detector deja de trabajar en cuanto ha dado su señal.

### Para quien contribuye

- `node --test`: tests unitarios sin dependencias (dominios, puntuación,
  ajustes, descargas, paridad de los 7 idiomas).
- `node scripts/e2e.mjs`: abre un Chrome de verdad con la extensión cargada y
  recorre el test-lab entero. También sin dependencias.

## 0.7.0 — julio de 2026

Ocho detectores contra técnicas de 2025-2026 (ClickFix, marca + contraseña,
secuestro del portapapeles, drainers Web3, browser-in-the-browser, HTML
smuggling, prompt injection oculta, SVG con JavaScript), validación de los
reportes de la comunidad por redes distintas, y rediseño del popup, el panel y
las opciones. El detalle está en el historial de git.
