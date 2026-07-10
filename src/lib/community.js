// Cliente de la reputación colaborativa. Todo respeta la privacidad:
// - reportSite() solo se llama tras acción MANUAL del usuario.
// - lookupHost() usa k-anonimato: envía solo el prefijo del hash del dominio;
//   el servidor devuelve todo el "cubo" y comparamos el hash completo en local,
//   así el servidor nunca sabe qué dominio exacto miras.

const PREFIX_LEN = 4; // hex → 65536 cubos

function base(apiBase) {
  return String(apiBase || "").replace(/\/+$/, "");
}
function normHost(host) {
  return String(host || "").toLowerCase().replace(/^www\./, "");
}

export async function getInstallId() {
  const { installId } = await chrome.storage.local.get("installId");
  if (installId) return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

export async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Devuelve el registro de la comunidad para este host, o null.
export async function lookupHost(apiBase, host) {
  const full = await sha256hex(normHost(host));
  const prefix = full.slice(0, PREFIX_LEN);
  const res = await fetch(`${base(apiBase)}/api/lookup.php?prefix=${prefix}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.matches || []).find((m) => m.h === full) || null;
}

export async function reportSite(apiBase, host, score, detectors) {
  const installId = await getInstallId();
  const res = await fetch(`${base(apiBase)}/api/report.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ installId, domain: normHost(host), score, detectors }),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return res.json();
}
