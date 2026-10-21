// Lógica de renderizado compartida entre el popup y el panel lateral.

import { t } from "./i18n.js";
import { detectorOf } from "../src/settings.js";

const LEVEL_KEY = {
  safe: "uStatusSafe",
  warning: "uStatusWarning",
  danger: "uStatusDanger",
};

let lastScore = 0;
let lastFindings = [];

let currentHost = "";
let isWhitelisted = false;
let lastTab = null;

// Sufijos de segundo nivel habituales (co.uk, gob.es, com.mx...): con ellos el
// dominio registrable abarca tres etiquetas en vez de dos.
const SECOND_LEVEL = new Set(["co", "com", "gob", "gov", "org", "net", "edu", "ac", "nom", "or", "ne"]);

// Pinta el host con el dominio registrable en negrita y los subdominios
// atenuados, como la barra de direcciones: lo que hay que comprobar es la parte
// destacada ("bbva.es.verificar-cuenta.top" se lee entonces como lo que es).
function renderHost(el, host) {
  el.textContent = "";
  const labels = host.split(".");
  let keep = 2;
  if (labels.length > 2 && SECOND_LEVEL.has(labels[labels.length - 2])) keep = 3;
  if (/^[\d.]+$/.test(host) || host.includes(":") || labels.length <= keep) {
    const b = document.createElement("b");
    b.textContent = host;
    el.appendChild(b);
    return;
  }
  const b = document.createElement("b");
  b.textContent = labels.slice(-keep).join(".");
  el.append(labels.slice(0, -keep).join(".") + ".", b);
}

// Medidor: la puntuación situada entre las marcas de los umbrales naranja y
// rojo, para que "riesgo 65" signifique algo a simple vista.
function renderMeter(score, thresholds) {
  const meter = document.getElementById("meter");
  const th = thresholds || { warning: 50, danger: 100 };
  const max = Math.max(th.danger * 1.5, score, 1);
  const pct = (v) => `${Math.min(100, (v / max) * 100)}%`;
  document.getElementById("meterFill").style.width = pct(score);
  document.getElementById("tickWarn").style.left = pct(th.warning);
  document.getElementById("tickDanger").style.left = pct(th.danger);
  document.getElementById("score").textContent = t("uRisk", [String(score)]);
  meter.hidden = false;
}

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export function renderState(tab) {
  if (!tab) return;
  lastTab = tab;

  const hostEl = document.getElementById("host");
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("statusText");
  const statusNote = document.getElementById("statusNote");
  const meterEl = document.getElementById("meter");
  const reasonsEl = document.getElementById("reasons");
  const emptyEl = document.getElementById("empty");
  const trustBtn = document.getElementById("trustBtn");

  chrome.runtime.sendMessage({ type: "getState", tabId: tab.id }, (st) => {
    statusNote.hidden = true;
    meterEl.hidden = true;
    if (chrome.runtime.lastError || !st) {
      statusEl.className = "verdict safe";
      statusText.textContent = t("uNoData");
      return;
    }

    try {
      currentHost = st.host || new URL(tab.url).hostname;
    } catch {
      currentHost = "";
    }
    renderHost(hostEl, currentHost);
    isWhitelisted = !!st.whitelisted;
    lastScore = st.score || 0;
    lastFindings = st.findings || [];

    // Botón de confianza (solo en páginas http/https con host).
    const onWeb = currentHost && /^https?:/.test(tab.url || "");
    if (onWeb) {
      trustBtn.hidden = false;
      trustBtn.textContent = t(isWhitelisted ? "uUntrustBtn" : "uTrustBtn");
    } else {
      trustBtn.hidden = true;
    }

    // Botón de reporte: en web, no en sitios de confianza del usuario.
    const reportBtn = document.getElementById("reportBtn");
    if (reportBtn) {
      reportBtn.hidden = !onWeb || isWhitelisted;
      reportBtn.disabled = false;
      reportBtn.textContent = t("uReport");
    }

    reasonsEl.textContent = "";

    if (isWhitelisted) {
      statusEl.className = "verdict trusted";
      statusText.textContent = t("uWhitelisted");
      emptyEl.hidden = true;
      return;
    }

    statusEl.className = `verdict ${st.level}`;
    statusText.textContent = t(LEVEL_KEY[st.level]);
    if (st.trusted && st.level === "safe") {
      statusNote.textContent = t("uTrustedSuffix");
      statusNote.hidden = false;
    }
    if (st.score > 0) renderMeter(st.score, st.thresholds);

    if (!st.findings.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    st.findings
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .forEach((f) => {
        const li = document.createElement("li");
        if (f.weight >= 60) li.className = "heavy";
        else if (f.weight >= 30) li.className = "medium";
        const title = document.createElement("span");
        title.className = "r-title";
        title.textContent = f.title;
        const weight = document.createElement("span");
        weight.className = "r-weight";
        weight.textContent = `+${f.weight}`;
        const small = document.createElement("small");
        small.textContent = f.detail;
        li.append(title, weight, small);
        if (f.learn) {
          const a = document.createElement("a");
          a.href = f.learn;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.className = "learn";
          a.textContent = t("uLearn");
          li.appendChild(a);
        }
        reasonsEl.appendChild(li);
      });
  });
}

export async function renderHistory() {
  const listEl = document.getElementById("history");
  const emptyEl = document.getElementById("historyEmpty");
  const { history = [] } = await chrome.storage.local.get("history");

  listEl.textContent = "";
  emptyEl.hidden = history.length > 0;

  history.slice(0, 30).forEach((h) => {
    const li = document.createElement("li");

    const dot = document.createElement("span");
    dot.className = `dot ${h.level}`;

    const hostDiv = document.createElement("span");
    hostDiv.className = "h-host";
    hostDiv.textContent = h.host || h.url;
    const reasons = document.createElement("small");
    reasons.textContent = (h.reasons || []).slice(0, 2).join(", ");
    hostDiv.appendChild(reasons);

    const date = document.createElement("span");
    date.className = "h-date";
    date.textContent = new Date(h.ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    li.append(dot, hostDiv, date);
    listEl.appendChild(li);
  });
}

// Conecta el botón de confianza y el borrado de historial (una sola vez).
export function wireActions() {
  document.getElementById("trustBtn").addEventListener("click", async () => {
    if (!currentHost) return;
    const type = isWhitelisted ? "untrust-host" : "trust-host";
    await chrome.runtime.sendMessage({ type, host: currentHost });
    isWhitelisted = !isWhitelisted;
    if (lastTab) renderState(lastTab);
  });

  document.getElementById("clearHistory").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "clear-history" });
    renderHistory();
  });

  const opts = document.getElementById("openOptions");
  if (opts) opts.addEventListener("click", () => chrome.runtime.openOptionsPage());

  const reportBtn = document.getElementById("reportBtn");
  if (reportBtn) {
    reportBtn.addEventListener("click", async () => {
      if (!currentHost) return;
      reportBtn.disabled = true;
      const detectors = [...new Set(lastFindings.map((f) => detectorOf(f.id)))];
      const r = await chrome.runtime.sendMessage({
        type: "report-site",
        host: currentHost,
        score: lastScore,
        detectors,
      });
      let key = "uReportErr";
      if (r && r.ok) key = r.duplicate ? "uReportDup" : "uReportOk";
      else if (r && r.error === "no_server") key = "uReportNoServer";
      reportBtn.textContent = t(key);
    });
  }
}
