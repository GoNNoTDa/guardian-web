// Lógica de renderizado compartida entre el popup y el panel lateral.

import { t } from "./i18n.js";
import { detectorOf, GROUPS } from "../src/settings.js";
import { registrable } from "../src/lib/domain.js";

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

// Pinta el host con el dominio registrable en negrita y los subdominios
// atenuados, como la barra de direcciones: lo que hay que comprobar es la parte
// destacada ("bbva.es.verificar-cuenta.top" se lee entonces como lo que es).
function renderHost(el, host) {
  el.textContent = "";
  const reg = registrable(host);
  const b = document.createElement("b");
  b.textContent = reg || host;
  if (reg && reg !== host && host.endsWith("." + reg)) el.append(host.slice(0, -reg.length));
  el.appendChild(b);
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
  const adviceEl = document.getElementById("advice");
  const reasonsEl = document.getElementById("reasons");
  const emptyEl = document.getElementById("empty");
  const trustBtn = document.getElementById("trustBtn");

  chrome.runtime.sendMessage({ type: "getState", tabId: tab.id }, (st) => {
    statusNote.hidden = true;
    meterEl.hidden = true;
    if (adviceEl) adviceEl.hidden = true;
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

    st.findings.sort((a, b) => (b.weight || 0) - (a.weight || 0));

    // Qué hacer, según la amenaza principal. Solo cuando hay aviso: con una
    // señal suelta de 15 puntos, un consejo alarma más de lo que ayuda.
    const advKey = `adv_${st.findings[0].group}`;
    if (adviceEl && st.level !== "safe" && t(advKey) !== advKey) {
      adviceEl.textContent = "";
      const b = document.createElement("b");
      b.textContent = t("uAdvice");
      adviceEl.append(b, " ", t(advKey));
      adviceEl.hidden = false;
    }

    st.findings
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

// Resumen del mes: cuántas veces ha avisado y de qué. Es la parte "aprende"
// del proyecto: ver que los intentos existen, y de qué tipo son los tuyos.
export async function renderStats() {
  const el = document.getElementById("stats");
  if (!el) return;
  const { stats = {} } = await chrome.storage.local.get("stats");
  const d = new Date();
  const month = stats[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] || {};
  const parts = GROUPS.filter((g) => month[g] > 0).sort((a, b) => month[b] - month[a]);
  const total = parts.reduce((n, g) => n + month[g], 0);
  el.hidden = total === 0;
  if (!total) return;
  el.textContent = "";
  const b = document.createElement("b");
  b.textContent = t(total === 1 ? "uStatsOne" : "uStatsMany", [String(total)]);
  const small = document.createElement("small");
  small.textContent = parts.map((g) => `${t(`grp_${g}`)} ${month[g]}`).join(" · ");
  el.append(b, small);
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
