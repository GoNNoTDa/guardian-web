# Ficha para la Chrome Web Store — Guardián Web

Todo listo para copiar y pegar en el Developer Dashboard. Textos en español e
inglés, propósito único, justificación de permisos (clave para la revisión) y
las declaraciones de privacidad obligatorias.

---

## Datos básicos

- **Nombre:** Guardián Web
- **Categoría:** Herramientas / Privacidad y seguridad
- **Idioma principal:** Español (se traduce solo a en, ca, fr, it, zh-CN, ja)

---

## Descripción corta (máx. 132 caracteres)

**ES:**
> Avisa de webs sospechosas y te enseña por qué. Sin telemetría, código abierto y con protección para bancos y trámites de España.

**EN:**
> Warns you about suspicious sites and teaches you why. No telemetry, open source, with protection for Spanish banks and services.

---

## Descripción detallada

### ES

**Guardián Web vigila el comportamiento de las webs que visitas y te avisa cuando algo no cuadra — sin espiarte y explicándote el porqué.**

A diferencia de otras extensiones de seguridad, Guardián Web no envía tu navegación a ningún servidor para "protegerte". Funciona en tu propio equipo y puedes activar el **modo local** para que no salga ni un dato. Es de **código abierto**: cualquiera puede auditar exactamente qué hace.

🛡️ QUÉ DETECTA
• Phishing y suplantación de marcas (typosquatting y homógrafos como "g00gle").
• Robo de datos de formularios y de tarjetas (skimmers).
• Cryptojacking (minado de criptomonedas en tu navegador).
• Estafas de "soporte técnico" y secuestro del navegador.
• Fingerprinting y rastreo excesivo.
• Descargas peligrosas (ejecutables disfrazados de PDF).
• Dominios recién creados, servidos desde IP o en listas de malware.

🇪🇸 PENSADA TAMBIÉN PARA ESPAÑA
Reconoce intentos de suplantación de BBVA, CaixaBank, Santander, Bizum, la
Agencia Tributaria, Correos, la DGT, la Seguridad Social y más — las estafas
más habituales que llegan por SMS y correo.

🔒 PRIVACIDAD DE VERDAD
• Sin telemetría ni analíticas.
• Sin cuenta ni registro.
• Modo 100 % local opcional.
• Lo que escribes se compara localmente y NUNCA se almacena ni se envía.
• Código abierto (MIT), auditable.

📚 ADEMÁS, ENSEÑA
Cada aviso incluye un enlace para aprender sobre esa amenaza (OSI, INCIBE,
OWASP). El objetivo no es solo protegerte, sino ayudarte a reconocer el peligro.

🤝 REPUTACIÓN DE LA COMUNIDAD (OPCIONAL)
Puedes reportar sitios problemáticos y beneficiarte de los que reporta la
comunidad. Las consultas usan k-anonimato: el servidor nunca sabe qué web
concreta visitas.

Guardián Web es una herramienta **defensiva**: avisa y explica, tú decides. No
sustituye a un antivirus.

### EN

**Guardián Web watches how the websites you visit behave and warns you when something is off — without spying on you, and explaining why.**

Unlike other security extensions, Guardián Web doesn't send your browsing to any server to "protect" you. It runs on your own device, and you can enable **local mode** so nothing leaves your machine. It's **open source**: anyone can audit exactly what it does.

🛡️ WHAT IT DETECTS
• Phishing and brand impersonation (typosquatting and homographs like "g00gle").
• Form and credit-card data theft (skimmers).
• Cryptojacking (in-browser crypto mining).
• Fake "tech support" scams and browser hijacking.
• Fingerprinting and excessive tracking.
• Dangerous downloads (executables disguised as PDFs).
• Newly created domains, raw-IP hosting, or domains on malware lists.

🔒 REAL PRIVACY
• No telemetry, no analytics.
• No account, no sign-up.
• Optional 100% local mode.
• What you type is compared locally and is NEVER stored or sent.
• Open source (MIT), auditable.

📚 IT ALSO TEACHES
Every warning links to learn more about that threat (OWASP, EFF, MDN). The goal
isn't only to protect you, but to help you recognize danger yourself.

🤝 COMMUNITY REPUTATION (OPTIONAL)
Report problematic sites and benefit from those reported by the community.
Lookups use k-anonymity: the server never knows which site you're visiting.

Guardián Web is a **defensive** tool: it warns and explains, you decide. It's
not a replacement for an antivirus.

---

## Propósito único (single purpose) — para la revisión

**ES:** Analizar el comportamiento de las páginas web que el usuario visita y
avisarle de indicios de actividad maliciosa (phishing, malware, cryptojacking,
exfiltración de datos y estafas), sin bloquear ni alterar el contenido.

**EN:** Analyze the behavior of the web pages the user visits and warn them
about signs of malicious activity (phishing, malware, cryptojacking, data
exfiltration and scams), without blocking or altering content.

---

## Justificación de permisos (para la revisión de Google)

Sé explícito aquí: es lo que más mira el revisor.

| Permiso | Justificación |
|---------|---------------|
| `webRequest` | Observar (no bloquear) las peticiones de la pestaña para detectar cryptojacking, redirecciones sospechosas y rastreo excesivo. |
| `webNavigation` | Saber cuándo se carga una página para analizarla y reiniciar el estado por pestaña. |
| `tabs` | Asociar los avisos a la pestaña correcta y llevar al usuario a ella desde una notificación. |
| `storage` | Guardar en local los ajustes, el historial y la lista de sitios de confianza. |
| `notifications` | Avisar de una amenaza aunque el usuario no mire la pestaña. |
| `sidePanel` | Mostrar el estado de seguridad en un panel lateral opcional. |
| `downloads` | Detectar descargas con nombre engañoso (doble extensión) o ejecutables de riesgo. |
| `alarms` | Programar la actualización periódica de la lista local de malware. |
| `host_permissions: <all_urls>` | Los detectores deben funcionar en cualquier sitio; los desconocidos son justo los peligrosos. No se recopila contenido: solo se analizan señales de seguridad en local. |

**Uso de código remoto:** ninguno. Todo el código se incluye en el paquete.

---

## Declaraciones de privacidad (formulario obligatorio del dashboard)

- **¿Recopila datos de uso?** No.
- **¿Recopila información personal?** No (sin cuenta, sin email, sin IP almacenada).
- **¿Recopila historial de navegación?** No se almacena ni se transmite. Las
  consultas de reputación opcionales usan k-anonimato o el modo local.
- **Datos manejados y finalidad:**
  - Ajustes, historial de avisos y lista de confianza → almacenamiento **local**.
  - Reporte a la comunidad → **solo cuando el usuario lo pulsa**; identificador
    anónimo, sin datos personales.
- **¿Se venden o transfieren datos a terceros?** No.
- **Enlace a la política de privacidad:** URL del `PRIVACY.md` publicado.
- **Certificaciones:** no vende datos; no los usa para fines ajenos al propósito
  único; no los usa para evaluar solvencia.

---

## Recursos gráficos

- **Icono de tienda:** 128×128 (ya existe en `icons/icon128.png`).
- **Capturas (1280×800 o 640×400), 1 a 5.** Sugerencias:
  1. Banner de aviso rojo sobre una web (`test-lab/danger-combo.html`).
  2. Popup con el desglose de señales y los enlaces "Aprende sobre esto".
  3. Panel lateral anclado.
  4. Página de opciones (detectores, modo local).
  5. Iconos de riesgo en resultados de búsqueda.
- **Imagen promocional pequeña:** 440×280 (opcional, recomendada).
- **Tile marquee:** 1400×560 (opcional).

Consejo: haz las capturas contra el `test-lab`, que dispara cada detector de
forma inofensiva y controlada.

---

## Antes de enviar (checklist)

- [ ] Rodaje hecho: falsos positivos bajo control y panel de errores limpio.
- [ ] `PRIVACY.md` publicado en una URL accesible.
- [ ] Capturas subidas.
- [ ] Justificación de cada permiso rellenada en el dashboard.
- [ ] Declaraciones de privacidad marcadas.
- [ ] Zip de `dist/` generado con `scripts/build.ps1`.
- [ ] Cuenta de desarrollador pagada (5 USD, pago único).
