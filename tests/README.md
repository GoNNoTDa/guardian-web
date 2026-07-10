# Tests end-to-end

Cargan la extensión real en Chrome (Puppeteer), recorren el `test-lab` y
verifican que cada página dispara los detectores esperados, leyendo el estado
del service worker.

```
cd tests
npm install
npm test
```

- Arranca el servidor del test-lab automáticamente (puerto 8000).
- Cubre los detectores deterministas: scam, iframes, formularios (HTTP y
  cross-domain), fingerprinting, permisos, minado, terceros, redirecciones y
  exfiltración, más `clean.html` como control de falsos positivos.
- **No cubiertos** (requieren mundo real o interacción del SO): reputación
  (necesita claves de API), descargas (diálogos del sistema) y homógrafos
  (necesitan el fichero `hosts`). Se prueban a mano con el test-lab.

Salida esperada: `Resultado: 8 OK, 0 fallos.`
