// Consultas de reputación en tiempo real. Cada función devuelve un "finding"
// (o null) que se integra en el mismo sistema de puntuación que las
// heurísticas locales. Todas fallan de forma silenciosa: si la API no
// responde o no hay clave, simplemente no aportan señal.
//
// v0.3: las claves llegan desde los ajustes (settings.apiKeys), no de un
// fichero editado a mano.

const GSB_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const URLHAUS_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/host/";

export async function checkReputation(url, settings) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return [];
  }

  const keys = (settings && settings.apiKeys) || {};
  const results = await Promise.allSettled([
    checkGoogleSafeBrowsing(url, keys.googleSafeBrowsing),
    checkURLhaus(host, keys.urlhaus),
  ]);

  return results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
}

async function checkGoogleSafeBrowsing(url, apiKey) {
  if (!apiKey) return null;

  const body = {
    client: { clientId: "guardian-web", clientVersion: "0.3.0" },
    threatInfo: {
      threatTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING",
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION",
      ],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }],
    },
  };

  try {
    const res = await fetch(`${GSB_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.matches) && data.matches.length) {
      const types = [...new Set(data.matches.map((m) => m.threatType))].join(", ");
      return {
        id: "gsb",
        weight: 100,
        confirmed: true, // amenaza verificada: cuenta incluso en dominios de confianza
        category: "reputation",
        title: "Google Safe Browsing: amenaza confirmada",
        detail: `Google clasifica esta URL como peligrosa. Tipos: ${types}.`,
      };
    }
  } catch {
    /* red no disponible: sin señal */
  }
  return null;
}

async function checkURLhaus(host, authKey) {
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (authKey) headers["Auth-Key"] = authKey;

  try {
    const res = await fetch(URLHAUS_ENDPOINT, {
      method: "POST",
      headers,
      body: `host=${encodeURIComponent(host)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.query_status === "ok") {
      const urls = data.urls || [];
      const online = urls.filter((u) => u.url_status === "online").length;
      return {
        id: "urlhaus",
        weight: online ? 100 : 70,
        confirmed: true, // amenaza verificada: cuenta incluso en dominios de confianza
        category: "reputation",
        title: "URLhaus: dominio asociado a malware",
        detail: `${urls.length} URL(s) maliciosas registradas en este dominio (${online} activas).`,
      };
    }
  } catch {
    /* red no disponible o clave requerida: sin señal */
  }
  return null;
}
