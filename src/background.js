// Service worker: capa de RED y orquestación.
// - Consulta la reputación de cada navegación (APIs externas, salvo modo local).
// - Vigila el tráfico de la pestaña (webRequest): minado, terceros, redirects.
// - Vigila las descargas (A3): extensiones peligrosas y doble extensión.
// - Acumula todas las señales (también las del content script) por pestaña,
//   aplica el filtro de detectores activos, recalcula el veredicto y avisa.
//
// v0.2: estado persistido en storage.session (C1), whitelist + confianza (A1),
//   historial (B2), panel lateral y notificaciones.
// v0.3: ajustes configurables (B1), modo local (C5), exfiltración (A2, en el
//   page-probe) y descargas peligrosas (A3).

import { checkReputation } from "./lib/reputation.js";
import { computeVerdict } from "./lib/scoring.js";
import { MINING_HOSTS, isSuspiciousTld } from "./lib/blocklists.js";
import { isTrusted, hostMatches } from "./lib/trusted.js";
import { getSettings, detectorOf } from "./settings.js";
import { learnUrl } from "./lib/learn.js";
import { lookupHost, reportSite } from "./lib/community.js";
import { ensureFeedAlarm, updateFeed, getFeedSet, invalidateFeedCache, FEED_ALARM } from "./lib/blockfeed.js";
import { isRawIp, weirdPort, domainAgeDays, isLocalOrPrivate } from "./lib/domain.js";
import { noteThirdParty, isKnownTracker } from "./lib/trackers.js";

// i18n: los textos de señales y notificaciones se resuelven aquí, en el
// idioma del navegador del usuario (B5).
const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

// Ajustes cacheados en el worker; se refrescan ante cambios en storage.
let settings = null;
async function ensureSettings() {
  if (!settings) settings = await getSettings();
  return settings;
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) settings = null; // recarga perezosa
  if (area === "local" && changes.feedHosts) invalidateFeedCache();
});

// Blocklist auto-actualizable (A7): alarma periódica + descarga inicial.
ensureFeedAlarm();
chrome.runtime.onInstalled.addListener(() => {
  ensureSettings().then(updateFeed);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FEED_ALARM) ensureSettings().then(updateFeed);
});

// Caché en memoria; la verdad persistente vive en chrome.storage.session.
const cache = new Map();

function freshState(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* url interna o vacía */
  }
  return {
    url,
    host,
    findings: new Map(),
    thirdParties: new Set(),
    learnedTrackers: new Set(),
    redirects: 0,
    shown: false,
    level: "safe",
    score: 0,
    trusted: false,
    whitelisted: false,
    historyKey: null,
    historyTs: 0,
    notifiedLevel: null,
  };
}

// --- Persistencia del estado (C1) -------------------------------------------
function serialize(st) {
  return {
    ...st,
    findings: [...st.findings.values()],
    thirdParties: [...st.thirdParties],
    learnedTrackers: [...st.learnedTrackers],
  };
}
function deserialize(o) {
  return {
    ...o,
    findings: new Map(o.findings.map((f) => [f.id, f])),
    thirdParties: new Set(o.thirdParties),
    learnedTrackers: new Set(o.learnedTrackers || []),
  };
}
async function getState(tabId) {
  if (cache.has(tabId)) return cache.get(tabId);
  const key = `tab:${tabId}`;
  const stored = (await chrome.storage.session.get(key))[key];
  const st = stored ? deserialize(stored) : freshState("");
  cache.set(tabId, st);
  return st;
}
function persist(tabId, st) {
  chrome.storage.session.set({ [`tab:${tabId}`]: serialize(st) }).catch(() => {});
}

// --- Whitelist del usuario (A1) ----------------------------------------------
async function getWhitelist() {
  return (await chrome.storage.local.get("whitelist")).whitelist || [];
}

// --- Señales y veredicto ------------------------------------------------------
async function addFindings(tabId, findings) {
  if (!findings || !findings.length) return;
  const cfg = await ensureSettings();
  const st = await getState(tabId);
  if (st.whitelisted) return; // el usuario confía: silencio total

  let changed = false;
  for (const f of findings) {
    if (!f || !f.id || st.findings.has(f.id)) continue;
    // Gate único: detector desactivado en los ajustes -> se ignora.
    if (cfg.detectors[detectorOf(f.id)] === false) continue;
    // En dominios de confianza solo cuentan las amenazas CONFIRMADAS.
    if (st.trusted && !f.confirmed) continue;
    // Enlace educativo por vector (objetivo divulgativo): cada aviso enseña.
    f.learn = learnUrl(detectorOf(f.id));
    st.findings.set(f.id, f);
    changed = true;
  }
  if (changed) await recompute(tabId, st, cfg);
}

async function recompute(tabId, st, cfg) {
  const verdict = computeVerdict([...st.findings.values()], cfg.thresholds);
  st.level = verdict.level;
  st.score = verdict.score;
  updateBadge(tabId, verdict);

  if (verdict.level === "warning" || verdict.level === "danger") {
    if (!st.historyKey) {
      st.historyTs = Date.now();
      st.historyKey = `${tabId}:${st.historyTs}`;
    }
    await logHistory(st, verdict);
    if (!st.shown) {
      st.shown = true;
      chrome.tabs.sendMessage(tabId, { type: "show-warning", verdict }).catch(() => {});
    }
    const shouldNotify =
      cfg.notifications &&
      ((verdict.level === "danger" && st.notifiedLevel !== "danger") ||
        (verdict.level === "warning" && !st.notifiedLevel));
    if (shouldNotify) {
      st.notifiedLevel = verdict.level;
      notify(tabId, st, verdict);
    }
  }
  persist(tabId, st);
}

function notify(tabId, st, verdict) {
  const danger = verdict.level === "danger";
  try {
    chrome.notifications.create(`guardian:${tabId}:${verdict.level}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: danger ? t("nDangerTitle") : t("nWarnTitle"),
      message: `${st.host}: ${verdict.reasons[0]?.title || t("fDefaultReason")}`,
      contextMessage: t("nContext"),
      priority: danger ? 2 : 1,
    });
  } catch {
    /* notificaciones bloqueadas por el sistema: el banner y el badge siguen */
  }
}

chrome.notifications.onClicked.addListener((id) => {
  const parts = String(id).split(":");
  if (parts[0] === "download") {
    chrome.downloads.showDefaultFolder();
  } else {
    const tabId = parseInt(parts[1], 10);
    if (!Number.isNaN(tabId)) {
      chrome.tabs.update(tabId, { active: true }).catch(() => {});
      chrome.tabs
        .get(tabId)
        .then((t) => chrome.windows.update(t.windowId, { focused: true }))
        .catch(() => {});
    }
  }
  chrome.notifications.clear(id);
});

function updateBadge(tabId, verdict) {
  const color =
    verdict.level === "danger" ? "#c0392b" : verdict.level === "warning" ? "#e67e22" : "#2ecc71";
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: verdict.level === "safe" ? "" : "!" }).catch(() => {});
}

// --- Historial (B2) -----------------------------------------------------------
async function logHistory(st, verdict) {
  try {
    const { history = [] } = await chrome.storage.local.get("history");
    const entry = {
      key: st.historyKey,
      host: st.host,
      url: st.url,
      level: verdict.level,
      score: verdict.score,
      reasons: verdict.reasons.slice(0, 6).map((r) => r.title),
      ts: st.historyTs,
    };
    const idx = history.findIndex((h) => h.key === st.historyKey);
    if (idx >= 0) history[idx] = entry;
    else history.unshift(entry);
    if (history.length > 200) history.length = 200;
    await chrome.storage.local.set({ history });
  } catch {
    /* sin historial no se rompe nada */
  }
}

// Edad de dominio con caché en storage.local (TTL 7 días) para no repetir la
// consulta RDAP en cada visita.
async function getDomainAgeCached(host) {
  const { domainAgeCache = {} } = await chrome.storage.local.get("domainAgeCache");
  const hit = domainAgeCache[host];
  const now = Date.now();
  if (hit && now - hit.ts < 7 * 86400000) return hit.days;
  const days = await domainAgeDays(host);
  domainAgeCache[host] = { days, ts: now };
  // Poda simple si crece demasiado.
  const keys = Object.keys(domainAgeCache);
  if (keys.length > 1000) delete domainAgeCache[keys[0]];
  chrome.storage.local.set({ domainAgeCache }).catch(() => {});
  return days;
}

// Registra en el historial un evento sin pestaña asociada (p. ej. descargas).
async function logStandalone(entry) {
  try {
    const { history = [] } = await chrome.storage.local.get("history");
    history.unshift(entry);
    if (history.length > 200) history.length = 200;
    await chrome.storage.local.set({ history });
  } catch {
    /* no crítico */
  }
}

// --- Navegación: reinicia estado, whitelist, reputación -----------------------
chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0) return; // solo el documento principal
  let host = "";
  try {
    host = new URL(d.url).hostname;
  } catch {
    return;
  }

  const cfg = await ensureSettings();
  const st = freshState(d.url);
  const wl = await getWhitelist();
  st.whitelisted = wl.some((w) => hostMatches(host, w));
  st.trusted = isTrusted(host);
  cache.set(d.tabId, st);
  persist(d.tabId, st);
  updateBadge(d.tabId, { level: "safe" });

  // Volcar las redirecciones acumuladas durante ESTA navegación.
  const redirects = pendingRedirects.get(d.tabId) || 0;
  pendingRedirects.delete(d.tabId);
  st.redirects = redirects;

  if (st.whitelisted) return;

  if (redirects >= 4) {
    addFindings(d.tabId, [
      {
        id: "redirect-chain",
        weight: 20,
        category: "reputation",
        title: t("fRedirTitle"),
        detail: t("fRedirDetail", [String(redirects)]),
      },
    ]);
  }

  if (host && isSuspiciousTld(host)) {
    addFindings(d.tabId, [
      {
        id: "bad-tld",
        weight: 5,
        category: "reputation",
        title: t("fTldTitle"),
        detail: t("fTldDetail"),
      },
    ]);
  }

  // Señales estructurales locales (estilo Netcraft), sin red. Se excluyen
  // localhost y las IPs privadas (desarrollo, intranet): no son sospechosas.
  const local = isLocalOrPrivate(host);
  const rawIp = isRawIp(host);
  if (rawIp && !local) {
    addFindings(d.tabId, [
      {
        id: "rawip",
        weight: 35,
        category: "reputation",
        title: t("fRawIpTitle"),
        detail: t("fRawIpDetail", [host]),
      },
    ]);
  }
  const port = weirdPort(d.url);
  if (port && !local) {
    addFindings(d.tabId, [
      {
        id: "weirdport",
        weight: 15,
        category: "reputation",
        title: t("fWeirdPortTitle"),
        detail: t("fWeirdPortDetail", [port]),
      },
    ]);
  }

  // Edad del dominio (RDAP): dominios muy recientes son típicos de phishing.
  // Es una consulta de red: se salta en modo local y en dominios de confianza.
  if (!cfg.localMode && cfg.detectors.domainage !== false && host && !rawIp && !local && !st.trusted) {
    const days = await getDomainAgeCached(host);
    if (days !== null && days <= 30) {
      addFindings(d.tabId, [
        {
          id: "domainage",
          weight: 40,
          category: "reputation",
          title: t("fDomainAgeTitle"),
          detail: t("fDomainAgeDetail", [String(days)]),
        },
      ]);
    }
  }

  // Feed local de malware (A7): consulta contra la copia descargada, sin red.
  const feed = await getFeedSet();
  if (host && feed.has(host.toLowerCase())) {
    addFindings(d.tabId, [
      {
        id: `feed:${host}`,
        weight: 90,
        confirmed: true,
        category: "reputation",
        title: t("fFeedTitle"),
        detail: t("fFeedDetail", [host]),
      },
    ]);
  }

  // Reputación: se salta en modo local (C5) o si el detector está desactivado.
  if (!cfg.localMode && cfg.detectors.reputation !== false) {
    const repFindings = await checkReputation(d.url, cfg);
    await addFindings(d.tabId, repFindings);
  }

  // Reputación colaborativa (k-anónima): dominios validados por la comunidad.
  // Externa: respeta modo local, requiere servidor configurado, no en confianza.
  if (!cfg.localMode && cfg.detectors.community !== false && cfg.communityUrl && !st.trusted) {
    try {
      const m = await lookupHost(cfg.communityUrl, host);
      if (m) {
        addFindings(d.tabId, [
          {
            id: "community",
            weight: 85,
            confirmed: true,
            category: "reputation",
            title: t("fCommunityTitle"),
            detail: t("fCommunityDetail", [String(m.n)]),
          },
        ]);
      }
    } catch {
      /* servidor caído: sin señal */
    }
  }
});

// --- Tráfico de red: minado, terceros -----------------------------------------
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    handleRequest(details);
  },
  { urls: ["<all_urls>"] }
);

async function handleRequest(details) {
  const st = await getState(details.tabId);
  if (st.whitelisted) return;

  let reqHost = "";
  try {
    reqHost = new URL(details.url).hostname;
  } catch {
    return;
  }

  const findings = [];

  if (MINING_HOSTS.some((h) => reqHost === h || reqHost.endsWith("." + h))) {
    findings.push({
      id: `mining:${reqHost}`,
      weight: 80,
      category: "malware",
      title: t("fMiningTitle"),
      detail: t("fMiningDetail", [reqHost]),
    });
  }

  if (st.host && reqHost !== st.host && !reqHost.endsWith("." + st.host)) {
    const before = st.thirdParties.size;
    st.thirdParties.add(reqHost);
    if (st.thirdParties.size === 20) {
      findings.push({
        id: "many-third-parties",
        weight: 15,
        category: "privacy",
        title: t("fThirdTitle"),
        detail: t("fThirdDetail"),
      });
    }

    // Solo la PRIMERA vez que vemos este tercero en esta pestaña: alimentar el
    // aprendizaje de rastreadores y contar los que ya conocíamos.
    if (st.thirdParties.size !== before) {
      noteThirdParty(st.host, reqHost).catch(() => {});
      if (await isKnownTracker(reqHost)) {
        st.learnedTrackers.add(reqHost);
        if (st.learnedTrackers.size === 8) {
          findings.push({
            id: "trackerlearn",
            weight: 15,
            category: "privacy",
            title: t("fTrackerLearnTitle"),
            detail: t("fTrackerLearnDetail", [String(st.learnedTrackers.size)]),
          });
        }
      }
      if (st.thirdParties.size <= 21 || st.learnedTrackers.size <= 8) {
        persist(details.tabId, st);
      }
    }
  }

  if (findings.length) await addFindings(details.tabId, findings);
}

// --- Cadenas de redirección ----------------------------------------------------
const pendingRedirects = new Map();
chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (details.tabId < 0 || details.type !== "main_frame") return;
    pendingRedirects.set(details.tabId, (pendingRedirects.get(details.tabId) || 0) + 1);
  },
  { urls: ["<all_urls>"] }
);

// --- Descargas peligrosas (A3) -------------------------------------------------
// Ejecutables de riesgo en Windows y "doble extensión" (factura.pdf.exe).
const RISKY_EXT = new Set([
  "exe", "scr", "com", "pif", "bat", "cmd", "msi", "msp", "hta", "cpl", "jar",
  "js", "jse", "vbs", "vbe", "wsf", "wsh", "ps1", "psm1", "reg", "lnk", "inf",
  "dll", "gadget", "apk", "app", "dmg", "iso", "img",
]);
const DOC_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "jpg",
  "jpeg", "png", "gif", "csv", "zip", "rar",
]);

function analyzeDownload(name) {
  const clean = (name || "").split(/[\\/]/).pop().toLowerCase();
  const parts = clean.split(".");
  if (parts.length < 2) return null;
  const ext = parts.pop();
  const prev = parts.length ? parts[parts.length - 1] : "";

  if (DOC_EXT.has(prev) && RISKY_EXT.has(ext)) {
    return {
      weight: 90,
      title: t("fDlDoubleTitle"),
      detail: t("fDlDoubleDetail", [clean, prev.toUpperCase(), ext]),
    };
  }
  if (RISKY_EXT.has(ext)) {
    return {
      weight: 45,
      title: t("fDlExeTitle"),
      detail: t("fDlExeDetail", [clean, ext]),
    };
  }
  return null;
}

// El nombre real llega tarde: onCreated suele traer filename vacío y las
// descargas por Blob no tienen extensión en la URL. Por eso el nombre se
// captura en onDeterminingFilename (nombre final propuesto) y, como refuerzo,
// en onChanged. dlUrls guarda la URL de origen; dlDone evita avisos dobles.
const dlUrls = new Map();
const dlDone = new Set();

async function reportDownload(id, filename, url) {
  if (dlDone.has(id)) return;
  const risk = analyzeDownload(filename) || analyzeDownload(url);
  if (!risk) return;
  dlDone.add(id); // marcar antes del await: evita duplicados entre listeners

  const cfg = await ensureSettings();
  if (cfg.detectors.downloads === false) return;

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* url rara o blob: */
  }
  const danger = risk.weight >= 90;

  if (cfg.notifications) {
    try {
      chrome.notifications.create(`download:${id}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: danger ? t("nDlDanger") : t("nDlWarn"),
        message: risk.detail,
        contextMessage: host ? t("nDlOrigin", [host]) : t("extName"),
        priority: danger ? 2 : 1,
      });
    } catch {
      /* notificaciones no disponibles */
    }
  }

  logStandalone({
    key: `dl:${id}`,
    host: host || t("nDownloadWord"),
    url: url || "",
    level: danger ? "danger" : "warning",
    score: risk.weight,
    reasons: [risk.title],
    ts: Date.now(),
  });
}

// Blindaje: si el API de descargas no estuviera disponible, registrar sus
// listeners tumbaría el service worker entero (y con él TODOS los detectores).
if (chrome.downloads) {
  chrome.downloads.onCreated.addListener((item) => {
    dlUrls.set(item.id, item.finalUrl || item.url || "");
    reportDownload(item.id, item.filename, dlUrls.get(item.id));
  });

  if (chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      reportDownload(item.id, item.filename, item.finalUrl || item.url || dlUrls.get(item.id));
      try {
        suggest(); // aceptar el nombre por defecto: solo observamos
      } catch {
        /* otro listener ya respondió */
      }
    });
  }

  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.filename && delta.filename.current) {
      reportDownload(delta.id, delta.filename.current, dlUrls.get(delta.id));
    }
    const state = delta.state && delta.state.current;
    if (state === "complete" || state === "interrupted") {
      dlUrls.delete(delta.id);
      dlDone.delete(delta.id);
    }
  });
}

// Evalúa un host con señales LOCALES (sin red) para el guardián de resultados
// de búsqueda. Devuelve "danger" | "warn" | "safe" | "trusted".
async function rateHost(host) {
  if (!host) return "safe";
  const h = host.toLowerCase().replace(/^www\./, "");
  if (isTrusted(h)) return "trusted";
  const feed = await getFeedSet();
  if (feed.has(h)) return "danger";
  if (MINING_HOSTS.some((m) => h === m || h.endsWith("." + m))) return "danger";
  if (isRawIp(h)) return "warn";
  if (isSuspiciousTld(h)) return "warn";
  if (await isKnownTracker(h)) return "warn";
  return "safe";
}

// --- Mensajería -----------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "findings" && sender.tab) {
    addFindings(sender.tab.id, msg.findings);
    return;
  }

  // Guardián de resultados de búsqueda: evaluar una lista de hosts en local.
  if (msg?.type === "rate-hosts" && Array.isArray(msg.hosts)) {
    (async () => {
      const cfg = await ensureSettings();
      if (cfg.searchGuard === false) {
        sendResponse({ ratings: {} });
        return;
      }
      const ratings = {};
      for (const h of msg.hosts.slice(0, 50)) ratings[h] = await rateHost(h);
      sendResponse({ ratings });
    })();
    return true;
  }

  if (msg?.type === "getState") {
    (async () => {
      const st = await getState(msg.tabId);
      sendResponse({
        level: st.level,
        score: st.score,
        findings: [...st.findings.values()],
        host: st.host,
        trusted: st.trusted,
        whitelisted: st.whitelisted,
      });
    })();
    return true;
  }

  if (msg?.type === "trust-status" && sender.tab) {
    (async () => {
      const st = await getState(sender.tab.id);
      const reasons = [...st.findings.values()].sort((a, b) => (b.weight || 0) - (a.weight || 0));
      sendResponse({
        trusted: st.trusted,
        whitelisted: st.whitelisted,
        verdict: { level: st.level, score: st.score, reasons },
      });
    })();
    return true;
  }

  if (msg?.type === "trust-host" && msg.host) {
    (async () => {
      const wl = await getWhitelist();
      if (!wl.includes(msg.host)) wl.push(msg.host);
      await chrome.storage.local.set({ whitelist: wl });
      for (const [tabId, st] of cache) {
        if (st.host === msg.host) {
          st.whitelisted = true;
          st.findings.clear();
          st.level = "safe";
          st.score = 0;
          updateBadge(tabId, { level: "safe" });
          persist(tabId, st);
        }
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg?.type === "untrust-host" && msg.host) {
    (async () => {
      const wl = await getWhitelist();
      await chrome.storage.local.set({ whitelist: wl.filter((w) => w !== msg.host) });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg?.type === "clear-history") {
    chrome.storage.local.set({ history: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }

  // Reporte manual de un sitio a la comunidad (acción explícita del usuario).
  if (msg?.type === "report-site" && msg.host) {
    (async () => {
      const cfg = await ensureSettings();
      if (!cfg.communityUrl) {
        sendResponse({ ok: false, error: "no_server" });
        return;
      }
      try {
        const r = await reportSite(cfg.communityUrl, msg.host, msg.score || 0, msg.detectors || []);
        sendResponse(r);
      } catch {
        sendResponse({ ok: false, error: "network" });
      }
    })();
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cache.delete(tabId);
  pendingRedirects.delete(tabId);
  chrome.storage.session.remove(`tab:${tabId}`).catch(() => {});
});
