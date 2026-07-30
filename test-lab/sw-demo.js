// Service worker de mentira para el laboratorio: existe solo para que la
// llamada a navigator.serviceWorker.register() sea real. No intercepta
// peticiones, no guarda nada en caché y no envía ni recibe notificaciones.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
// Ni un solo listener de "fetch" ni de "push": este worker no hace nada.
