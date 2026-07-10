// Ajustes de la extensión (B1) — fuente de verdad en chrome.storage.local
// bajo la clave "settings". La página de opciones los escribe; el background
// los lee y los cachea, refrescándose ante cambios.

export const DETECTORS = [
  { key: "reputation", label: "Reputación (Safe Browsing / URLhaus)", group: "red" },
  { key: "redirects", label: "Cadenas de redirección", group: "red" },
  { key: "tld", label: "TLD de riesgo", group: "red" },
  { key: "mining", label: "Cryptojacking / minado", group: "red" },
  { key: "thirdparties", label: "Exceso de dominios de terceros", group: "red" },
  { key: "typosquat", label: "Typosquatting y homógrafos", group: "phishing" },
  { key: "insecureform", label: "Contraseña sin cifrar (HTTP)", group: "phishing" },
  { key: "crossform", label: "Login enviado a otro dominio", group: "phishing" },
  { key: "exfil", label: "Exfiltración de datos de formularios", group: "phishing" },
  { key: "scam", label: "Texto de estafa / soporte falso", group: "scam" },
  { key: "iframes", label: "Iframes ocultos (clickjacking)", group: "scam" },
  { key: "permissions", label: "Permisos pedidos al entrar", group: "scam" },
  { key: "fingerprint", label: "Fingerprinting de canvas", group: "privacidad" },
  { key: "downloads", label: "Descargas peligrosas", group: "descargas" },
];

export const DEFAULTS = {
  localMode: false, // true = sin llamadas a APIs externas (C5)
  notifications: true,
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
  "redirect-chain": "redirects",
  "bad-tld": "tld",
  mining: "mining",
  "fp-mining": "mining",
  "many-third-parties": "thirdparties",
  homograph: "typosquat",
  typo: "typosquat",
  "other-tld": "typosquat",
  "pwd-http": "insecureform",
  "pwd-cross": "crossform",
  exfil: "exfil",
  "scam-text": "scam",
  "hidden-iframes": "iframes",
  "perm-notif": "permissions",
  "perm-geo": "permissions",
  "fp-canvas": "fingerprint",
  download: "downloads",
};

export function detectorOf(id) {
  return ID_TO_DETECTOR[String(id).split(":")[0]] || "other";
}
