# Checklist de publicación en la Chrome Web Store

Pasos, en orden, para subir Guardián Web.

## 1. Cuenta de desarrollador (una sola vez)

- [ ] Entra en <https://chrome.google.com/webstore/devconsole>.
- [ ] Paga la cuota única de registro de desarrollador (5 USD).
- [ ] Configura el email de contacto y verifícalo (obligatorio para publicar).

## 2. Preparar el paquete

- [ ] Ejecuta `pwsh scripts/build.ps1`.
- [ ] Se genera `dist/guardian-web-vX.Y.Z.zip` (solo manifest, src, ui, icons,
      _locales — sin test-lab, tests ni docs).
- [ ] Comprueba que el zip NO incluye tus claves de API (viven en el equipo del
      usuario, no en el código: correcto).

## 3. Recursos gráficos (ver carpeta screenshots/)

- [ ] Icono de la tienda 128×128 (ya está en `icons/icon128.png`).
- [ ] 1 a 5 capturas de 1280×800 o 640×400 (ver `screenshots/README.md`).
- [ ] (Opcional) Imagen promocional pequeña 440×280.

## 4. Rellenar la ficha (usa STORE_LISTING.md)

- [ ] Nombre, descripción breve y descripción detallada.
- [ ] Categoría: Herramientas / Privacidad y seguridad.
- [ ] Idioma principal: español.
- [ ] (Opcional) Añade fichas traducidas en en, ca, fr, it, zh-CN, ja.

## 5. Privacidad y permisos (usa PERMISSIONS_JUSTIFICATION.md y DATA_DISCLOSURE.md)

- [ ] Propósito único.
- [ ] Justificación de cada permiso y de `<all_urls>`.
- [ ] Declaración de "no se usa código remoto".
- [ ] Formulario de prácticas de datos.
- [ ] URL de la política de privacidad (PRIVACY.md publicado en GitHub).
- [ ] En "notas para el revisor": aclara que el detector de exfiltración compara
      en memoria y no transmite datos, y que webRequest es solo de observación.

## 6. Distribución

- [ ] Visibilidad: pública (o "no listada" si prefieres compartir solo por
      enlace al principio).
- [ ] Regiones: todas.

## 7. Enviar y esperar revisión

- [ ] Envía a revisión. Suele tardar de horas a unos días.
- [ ] Si piden aclaraciones sobre permisos, responde con los textos de
      PERMISSIONS_JUSTIFICATION.md.

## Consejos para pasar la revisión a la primera

- Pedir `<all_urls>` + `webRequest` recibe escrutinio extra: la justificación
  ya redactada explica que es solo observación y por qué es imprescindible.
- Tener la política de privacidad publicada y enlazada evita rechazos.
- El "modo local" y el código abierto juegan a favor: demuéstralo enlazando el
  repositorio en la ficha.
