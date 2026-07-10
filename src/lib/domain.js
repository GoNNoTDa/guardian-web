// Señales estructurales de dominio, al estilo del "Risk Rating" de Netcraft.
// isRawIp y weirdPort son 100% locales. domainAgeDays consulta RDAP (red):
// el background solo la usa fuera del modo local.

export function isRawIp(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  if (host.startsWith("[") && host.includes(":")) return true; // IPv6 entre []
  return false;
}

// localhost e IPs privadas/reservadas: son legítimas (desarrollo, intranet) y
// NO deben marcarse como "servido desde IP" ni por puerto raro.
export function isLocalOrPrivate(host) {
  const h = host.replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "::1") return true;
  const m = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  return (
    a === 127 || // loopback
    a === 10 || // privada
    (a === 192 && b === 168) || // privada
    (a === 172 && b >= 16 && b <= 31) || // privada
    (a === 169 && b === 254) // link-local
  );
}

// Devuelve el puerto si es no estándar (ni 80 ni 443), o null.
export function weirdPort(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.port && u.port !== "80" && u.port !== "443") return u.port;
  } catch {
    /* url inválida */
  }
  return null;
}

// Dominio registrable aproximado (saltando sufijos compuestos cortos como
// .co.uk / .gob.es): coge la última etiqueta larga y su TLD.
export function registrable(host) {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const tail = parts.slice(-2);
  // Si el penúltimo trozo es un sufijo corto (co, com, gob, org...), coge uno más.
  if (parts[parts.length - 2].length <= 3 && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return tail.join(".");
}

// Edad del dominio en días vía RDAP (rdap.org agrega los registros). null si
// no se puede determinar. Es una consulta de red: el llamante decide si la
// hace (respeta el modo local).
export async function domainAgeDays(host) {
  const reg = registrable(host);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(reg)}`, {
      headers: { Accept: "application/rdap+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ev = (data.events || []).find((e) => e.eventAction === "registration");
    if (!ev || !ev.eventDate) return null;
    const ms = Date.now() - Date.parse(ev.eventDate);
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 86400000);
  } catch {
    return null; // sin red o dominio sin RDAP: sin señal
  }
}
