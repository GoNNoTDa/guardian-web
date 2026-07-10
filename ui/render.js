// Lógica de renderizado compartida entre el popup y el panel lateral.

import { t } from "./i18n.js";

const LEVEL_KEY = {
  safe: "uStatusSafe",
  warning: "uStatusWarning",
  danger: "uStatusDanger",
};

let currentHost = "";
let isWhitelisted = false;
let lastTab = null;

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export function renderState(tab) {
  if (!tab) return;
  lastTab = tab;

  const hostEl = document.getElementById("host");
  const statusEl = document.getElementById("status");
  const reasonsEl = document.getElementById("reasons");
  const emptyEl = document.getElementById("empty");
  const trustBtn = document.getElementById("trustBtn");

  chrome.runtime.sendMessage({ type: "getState", tabId: tab.id }, (st) => {
    if (chrome.runtime.lastError || !st) {
      statusEl.className = "safe";
      statusEl.textContent = t("uNoData");
      return;
    }

    try {
      currentHost = st.host || new URL(tab.url).hostname;
    } catch {
      currentHost = "";
    }
    hostEl.textContent = currentHost;
    isWhitelisted = !!st.whitelisted;

    // Botón de confianza (solo en páginas http/https con host).
    if (currentHost && /^https?:/.test(tab.url || "")) {
      trustBtn.hidden = false;
      trustBtn.textContent = t(isWhitelisted ? "uUntrustBtn" : "uTrustBtn");
    } else {
      trustBtn.hidden = true;
    }

    reasonsEl.textContent = "";

    if (isWhitelisted) {
      statusEl.className = "trusted";
      statusEl.textContent = t("uWhitelisted");
      emptyEl.style.display = "none";
      return;
    }

    statusEl.className = st.level;
    statusEl.textContent = `${t(LEVEL_KEY[st.level])} · ${t("uRisk", [String(st.score)])}`;
    if (st.trusted && st.level === "safe") {
      statusEl.textContent += ` · ${t("uTrustedSuffix")}`;
    }

    if (!st.findings.length) {
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    st.findings
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .forEach((f) => {
        const li = document.createElement("li");
        const b = document.createElement("b");
        b.textContent = f.title;
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `${f.category} · +${f.weight}`;
        b.appendChild(badge);
        const small = document.createElement("small");
        small.textContent = f.detail;
        li.append(b, small);
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
  emptyEl.style.display = history.length ? "none" : "block";

  history.slice(0, 30).forEach((h) => {
    const li = document.createElement("li");

    const dot = document.createElement("span");
    dot.className = `dot ${h.level}`;

    const hostDiv = document.createElement("span");
    hostDiv.className = "h-host";
    hostDiv.textContent = h.host || h.url;
    const reasons = document.createElement("small");
    reasons.textContent = (h.reasons || []).slice(0, 2).join(" · ");
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
}
