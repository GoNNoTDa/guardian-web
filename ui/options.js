// Página de opciones (B1). Lee y escribe los ajustes en chrome.storage.local
// vía el módulo settings.js. También gestiona la whitelist del usuario.

import { getSettings, saveSettings, DEFAULTS, DETECTORS } from "../src/settings.js";
import { t, localizePage } from "./i18n.js";

const $ = (id) => document.getElementById(id);

localizePage();

async function load() {
  const s = await getSettings();

  $("localMode").checked = s.localMode;
  $("notifications").checked = s.notifications;
  $("searchGuard").checked = s.searchGuard;
  $("gsbKey").value = s.apiKeys.googleSafeBrowsing || "";
  $("urlhausKey").value = s.apiKeys.urlhaus || "";
  $("thWarning").value = s.thresholds.warning;
  $("thDanger").value = s.thresholds.danger;

  renderDetectors(s.detectors);
  toggleLocalNote();
  await renderWhitelist();
}

function renderDetectors(state) {
  const box = $("detectors");
  box.textContent = "";
  for (const d of DETECTORS) {
    const label = document.createElement("label");
    label.className = "det";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.key = d.key;
    cb.checked = state[d.key] !== false;
    const txt = document.createElement("span");
    txt.textContent = t(`det_${d.key}`);
    const g = document.createElement("span");
    g.className = "g";
    g.textContent = t(`grp_${d.group}`);
    label.append(cb, txt, g);
    box.appendChild(label);
  }
}

function collect() {
  const detectors = {};
  document.querySelectorAll("#detectors input[data-key]").forEach((cb) => {
    detectors[cb.dataset.key] = cb.checked;
  });
  let warning = parseInt($("thWarning").value, 10) || DEFAULTS.thresholds.warning;
  let danger = parseInt($("thDanger").value, 10) || DEFAULTS.thresholds.danger;
  if (danger < warning) danger = warning; // rojo nunca por debajo de naranja
  return {
    localMode: $("localMode").checked,
    notifications: $("notifications").checked,
    searchGuard: $("searchGuard").checked,
    apiKeys: {
      googleSafeBrowsing: $("gsbKey").value.trim(),
      urlhaus: $("urlhausKey").value.trim(),
    },
    thresholds: { warning, danger },
    detectors,
  };
}

function toggleLocalNote() {
  $("localNote").hidden = !$("localMode").checked;
}

async function renderWhitelist() {
  const listEl = $("whitelist");
  const emptyEl = $("whitelistEmpty");
  const { whitelist = [] } = await chrome.storage.local.get("whitelist");

  listEl.textContent = "";
  emptyEl.style.display = whitelist.length ? "none" : "block";

  whitelist.forEach((host) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = host;
    const btn = document.createElement("button");
    btn.textContent = t("oRemove");
    btn.addEventListener("click", async () => {
      const cur = (await chrome.storage.local.get("whitelist")).whitelist || [];
      await chrome.storage.local.set({ whitelist: cur.filter((h) => h !== host) });
      renderWhitelist();
    });
    li.append(span, btn);
    listEl.appendChild(li);
  });
}

function flashSaved() {
  const el = $("saved");
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 1800);
}

$("localMode").addEventListener("change", toggleLocalNote);

$("save").addEventListener("click", async () => {
  await saveSettings(collect());
  flashSaved();
});

$("reset").addEventListener("click", async () => {
  await saveSettings(DEFAULTS);
  await load();
  flashSaved();
});

load();
