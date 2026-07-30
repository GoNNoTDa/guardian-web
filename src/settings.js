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
  { key: "insecureform", group: "phishing" },
  { key: "crossform", group: "phishing" },
  { key: "exfil", group: "phishing" },
  { key: "skimmer", group: "phishing" },
  { key: "scam", group: "scam" },
  { key: "clickfix", group: "scam" },
  { key: "clipswap", group: "scam" },
  { key: "iframes", group: "scam" },
  { key: "permissions", group: "scam" },
  { key: "locker", group: "scam" },
  { key: "fingerprint", group: "privacy" },
  { key: "downloads", group: "downloads" },
];

export const DEFAULTS = {
  localMode: false, // true = sin llamadas a APIs externas (C5)
  notifications: true,
  searchGuard: true, // iconos de riesgo en resultados de búsqueda (local)
  communityUrl: "https://sec.fourmartech.es", // backend colaborativo (vacío = desactivado)
  thresholds: { warning: 50, danger: 100 },
  apiKeys: { googleSafeBrowsing: "", urlhaus: "" },
  detectors: Object.fromEntries(DETECTORS.map((d) => [d.key, true])),
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
  brandform: "brandform",
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
  locker: "locker",
  "fp-canvas": "fingerprint",
  download: "downloads",
};

export function detectorOf(id) {
  return ID_TO_DETECTOR[String(id).split(":")[0]] || "other";
}
