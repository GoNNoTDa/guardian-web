// Ajustes de la extensión (B1) — fuente de verdad en chrome.storage.local
// bajo la clave "settings". La página de opciones los escribe; el background
// los lee y los cachea, refrescándose ante cambios.

// Las etiquetas visibles viven en _locales (claves det_<key> y grp_<group>).
export const DETECTORS = [
  { key: "reputation", group: "net" },
  { key: "community", group: "net" },
  { key: "redirects", group: "net" },
  { key: "tld", group: "net" },
  { key: "rawip", group: "net" },
  { key: "weirdport", group: "net" },
  { key: "domainage", group: "net" },
  { key: "mining", group: "net" },
  { key: "thirdparties", group: "net" },
  { key: "trackerlearn", group: "privacy" },
  { key: "typosquat", group: "phishing" },
  { key: "brandform", group: "phishing" },
  { key: "fakewindow", group: "phishing" },
  { key: "svgscript", group: "phishing" },
  { key: "insecureform", group: "phishing" },
  { key: "crossform", group: "phishing" },
  { key: "exfil", group: "phishing" },
  { key: "skimmer", group: "phishing" },
  { key: "scam", group: "scam" },
  { key: "clickfix", group: "scam" },
  { key: "clipswap", group: "scam" },
  { key: "iframes", group: "scam" },
  { key: "permissions", group: "scam" },
  { key: "notifbait", group: "scam" },
  { key: "locker", group: "scam" },
  { key: "fingerprint", group: "privacy" },
  { key: "walletsign", group: "web3" },
  { key: "seedphrase", group: "web3" },
  { key: "promptinject", group: "ai" },
  { key: "downloads", group: "downloads" },
  { key: "smuggling", group: "downloads" },
];

export const DEFAULTS = {
  localMode: false, // true = sin llamadas a APIs externas (C5)
  notifications: true,
  searchGuard: true, // iconos de riesgo en resultados de búsqueda (local)
  communityUrl: "https://sec.fourmartech.es", // backend colaborativo (vacío = desactivado)
  thresholds: { warning: 50, danger: 100 },
  apiKeys: { googleSafeBrowsing: "", urlhaus: "" },
  detectors: {
    ...Object.fromEntries(DETECTORS.map((d) => [d.key, true])),
    // La edad de dominio pregunta a rdap.org por cada sitio desconocido: eso
    // es enviar tu navegación a un tercero, así que es opcional (opt-in).
    domainage: false,
  },
};

export function mergeDefaults(s) {
  s = s || {};
  return {
    ...DEFAULTS,
    ...s,
    thresholds: { ...DEFAULTS.thresholds, ...(s.thresholds || {}) },
    apiKeys: { ...DEFAULTS.apiKeys, ...(s.apiKeys || {}) },
    detectors: { ...DEFAULTS.detectors, ...(s.detectors || {}) },
  };
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return mergeDefaults(settings);
}

export async function saveSettings(s) {
  await chrome.storage.local.set({ settings: mergeDefaults(s) });
}

// Mapea el id de un finding a la clave de detector que lo gobierna. Permite
// un ÚNICO punto de filtrado (en el background) sin tocar cada creación.
const ID_TO_DETECTOR = {
  gsb: "reputation",
  urlhaus: "reputation",
  feed: "reputation",
  community: "community",
  "redirect-chain": "redirects",
  "bad-tld": "tld",
  rawip: "rawip",
  weirdport: "weirdport",
  domainage: "domainage",
  mining: "mining",
  "fp-mining": "mining",
  "many-third-parties": "thirdparties",
  trackerlearn: "trackerlearn",
  homograph: "typosquat",
  typo: "typosquat",
  "other-tld": "typosquat",
  "brand-sub": "typosquat",
  combo: "typosquat",
  brandform: "brandform",
  fakewindow: "fakewindow",
  svgscript: "svgscript",
  "pwd-http": "insecureform",
  "pwd-cross": "crossform",
  exfil: "exfil",
  skimmer: "skimmer",
  "scam-text": "scam",
  clickfix: "clickfix",
  clipswap: "clipswap",
  "hidden-iframes": "iframes",
  "perm-notif": "permissions",
  "perm-geo": "permissions",
  notifbait: "notifbait",
  locker: "locker",
  "fp-canvas": "fingerprint",
  web3: "walletsign",
  seedphrase: "seedphrase",
  promptinject: "promptinject",
  download: "downloads",
  smuggling: "smuggling",
};

export function detectorOf(id) {
  return ID_TO_DETECTOR[String(id).split(":")[0]] || "other";
}

// Grupo al que pertenece un detector ("phishing", "scam"…). De él sale el
// consejo del aviso y la categoría del resumen mensual.
const GROUP_OF = Object.fromEntries(DETECTORS.map((d) => [d.key, d.group]));
export function groupOf(detectorKey) {
  return GROUP_OF[detectorKey] || "net";
}
export const GROUPS = [...new Set(DETECTORS.map((d) => d.group))];

// --- Copia de seguridad de los ajustes (exportar / importar) ----------------
// Lo importado es un fichero cualquiera: se valida campo a campo y lo que no
// encaja se descarta, en vez de volcarlo tal cual al storage. Las claves de
// API no viajan en la copia (son secretos: el fichero acaba en Descargas, en
// el correo o en un chat).
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function exportBundle(settings, whitelist, version) {
  const { apiKeys, ...rest } = mergeDefaults(settings);
  return {
    app: "guardian-web",
    version: String(version || ""),
    exported: new Date().toISOString(),
    settings: rest,
    whitelist: [...(whitelist || [])],
  };
}

// Devuelve { settings, whitelist } saneados, o null si no es una copia válida.
// `current` son los ajustes actuales: de ahí se conservan las claves de API.
export function sanitizeImport(raw, current) {
  if (!raw || typeof raw !== "object" || raw.app !== "guardian-web") return null;
  const src = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const cur = mergeDefaults(current);
  const out = mergeDefaults({ apiKeys: cur.apiKeys });

  for (const k of ["localMode", "notifications", "searchGuard"]) {
    if (typeof src[k] === "boolean") out[k] = src[k];
  }
  if (typeof src.communityUrl === "string") {
    const u = src.communityUrl.trim().replace(/\/+$/, "");
    // Solo https: por ahí viajan tus reportes y las consultas de reputación.
    if (u === "" || /^https:\/\/[^\s/]+(\/[^\s]*)?$/i.test(u)) out.communityUrl = u.slice(0, 200);
  }
  const th = src.thresholds && typeof src.thresholds === "object" ? src.thresholds : {};
  const num = (v, def) => (Number.isFinite(v) ? Math.min(500, Math.max(10, Math.round(v))) : def);
  const warning = num(th.warning, DEFAULTS.thresholds.warning);
  out.thresholds = { warning, danger: Math.max(warning, num(th.danger, DEFAULTS.thresholds.danger)) };

  const det = src.detectors && typeof src.detectors === "object" ? src.detectors : {};
  for (const d of DETECTORS) {
    if (typeof det[d.key] === "boolean") out.detectors[d.key] = det[d.key];
  }

  const seen = new Set();
  const whitelist = [];
  for (const h of Array.isArray(raw.whitelist) ? raw.whitelist : []) {
    const host = typeof h === "string" ? h.trim().toLowerCase() : "";
    if (!HOST_RE.test(host) || seen.has(host)) continue;
    seen.add(host);
    whitelist.push(host);
    if (whitelist.length >= 500) break;
  }
  return { settings: out, whitelist };
}
