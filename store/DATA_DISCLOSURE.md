# Declaración de uso de datos (pestaña "Privacy" del Dashboard)

Respuestas para el formulario de prácticas de privacidad de la Web Store.

## ¿Qué datos de usuario recopila o transmite la extensión?

Marca **únicamente** lo siguiente y desmarca el resto:

- **Actividad de navegación web**: SÍ, condicional.
  - Aclaración: solo si el usuario activa las consultas de reputación (no es el
    modo por defecto si no hay claves de API). En ese caso, la URL/el dominio
    visitado se envía a Google Safe Browsing y/o URLhaus para comprobar si es
    maliciosa. El usuario puede desactivarlo por completo con el "modo local".

Todo lo demás (información personal identificable, datos de salud, financieros,
de autenticación, mensajes personales, ubicación, actividad fuera de esta
finalidad): **NO se recopila ni se transmite.**

## Casillas obligatorias de certificación

Puedes marcar las tres con verdad:

- ☑ No vendo ni transfiero los datos del usuario a terceros (salvo los casos de
  uso aprobados: aquí, ninguna venta ni transferencia).
- ☑ No uso ni transfiero los datos para fines ajenos a la funcionalidad
  principal del artículo.
- ☑ No uso ni transfiero los datos para determinar solvencia ni con fines de
  préstamo.

## URL de la política de privacidad

Enlaza al archivo `PRIVACY.md` publicado en tu repositorio, por ejemplo:
`https://github.com/USUARIO/guardian-web/blob/main/PRIVACY.md`

## Nota sobre el detector de exfiltración

Aunque la extensión "observa" lo que el usuario teclea en campos sensibles para
el detector de exfiltración, esos datos **no se recopilan ni se transmiten**:
se comparan en memoria dentro de la propia página y se descartan. Por tanto no
constituyen recogida de datos según la definición de la Store. Conviene
mencionarlo en las notas para el revisor para evitar malentendidos.
