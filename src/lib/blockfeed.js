// Blocklist auto-actualizable (A7): descarga periódicamente el hostfile
// público de URLhaus (abuse.ch) y lo guarda en chrome.storage.local. A
// diferencia de la consulta por-URL de reputation.js, esto funciona OFFLINE
// una vez descargado y no envía las URLs que visitas a ningún sitio: la
// comprobación es contra la copia local.
//
// Respeta el modo local: con localMode activo NO se descarga (la copia ya
// existente sí se sigue consultando: es un dato local).

const FEED_URL = "https://urlhaus.abuse.ch/downloads/hostfile/";
export const FEED_ALARM = "guardian-feed-update";
const REFRESH_HOURS = 12;
const MAX_HOSTS = 50000; // techo de seguridad para no inflar el storage

export async function ensureFeedAlarm() {
  try {
    const existing = await chrome.alarms.get(FEED_ALARM);
    if (!existing) {
      chrome.alarms.create(FEED_ALARM, {
        periodInMinutes: 60 * REFRESH_HOURS,
        delayInMinutes: 1, // primera descarga al minuto de arrancar
      });
    }
  } catch {
    /* sin alarms no hay refresco automático; el resto funciona igual */
  }
}

export async function updateFeed(settings) {
  if (settings && settings.localMode) return;
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) return;
    const text = await res.text();
    const hosts = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      // Formato hostfile: "127.0.0.1<tab>dominio.malo"
      const parts = t.split(/\s+/);
      const h = (parts[1] || parts[0] || "").toLowerCase();
      if (h && h.includes(".")) hosts.push(h);
      if (hosts.length >= MAX_HOSTS) break;
    }
    if (hosts.length) {
      await chrome.storage.local.set({ feedHosts: hosts, feedUpdated: Date.now() });
    }
  } catch {
    /* sin red: se reintenta en la próxima alarma */
  }
}

// Set en memoria para consultas O(1); se invalida cuando cambia el storage.
let feedSet = null;

export async function getFeedSet() {
  if (feedSet) return feedSet;
  const { feedHosts = [] } = await chrome.storage.local.get("feedHosts");
  feedSet = new Set(feedHosts);
  return feedSet;
}

export function invalidateFeedCache() {
  feedSet = null;
}
