# Test-lab de Guardián Web

Laboratorio **local e inofensivo** para disparar cada detector de la extensión
y calibrar pesos/umbrales. Nada sale a Internet: los dominios "maliciosos" son
TLDs reservados por la RFC 2606 (`.test`, `.example`) que nunca resuelven.

## Arrancar

```
cd test-lab
node server.js
```

Abre <http://127.0.0.1:8000> y sigue la tabla del índice. Cada página documenta
las señales que debe disparar y el resultado esperado (banner naranja/rojo,
notificación, o solo entrada en el panel).

## Matriz de cobertura

| Detector | Página | Puntos |
|----------|--------|--------|
| Texto de estafa | scam.html, danger-combo.html | 45 |
| Iframes ocultos | scam.html, danger-combo.html | 25 |
| Contraseña por HTTP | phishing-form.html, danger-combo.html | 50 |
| Login a otro dominio | phishing-form.html, danger-combo.html | 35 |
| Fingerprinting canvas | fingerprint.html, danger-combo.html | 20 |
| Geolocalización al entrar | fingerprint.html | 20 |
| Notificaciones al entrar | fingerprint.html | 15 |
| Minado (WASM + workers) | mining.html | 40 |
| +20 dominios de terceros | third-parties.html | 15 |
| Cadena de redirecciones | /go | 20 |
| Homógrafo (leet/confusables) | homograph.html + fichero hosts | 80 |
| Typosquatting | homograph.html + fichero hosts | 60 |
| Falsos positivos (control) | clean.html | 0 |

Sin cubrir en local (requieren mundo real): Google Safe Browsing / URLhaus
(usar <https://testsafebrowsing.appspot.com>), dominio de minado conocido en la
blocklist, TLD de riesgo.

## Notas

- El **orden de los avisos**: badge → banner en página → notificación del
  sistema → detalle en panel lateral.
- Para probar la notificación con pestaña en segundo plano: abre scam.html con
  clic central desde el índice.
- El detector de homógrafos necesita entradas en
  `C:\Windows\System32\drivers\etc\hosts` (instrucciones en homograph.html).
  Recuerda limpiarlas al acabar.
