// Panel lateral: como el popup, pero permanece anclado a la derecha y se
// actualiza en vivo al cambiar de pestaña, al navegar y cuando el background
// registra nuevas señales (via chrome.storage.onChanged).

import { getActiveTab, renderState, renderHistory, wireActions } from "./render.js";
import { localizePage } from "./i18n.js";

localizePage();

let pending = null;
function refresh() {
  // Debounce: los eventos llegan a ráfagas (navegación + señales + storage).
  clearTimeout(pending);
  pending = setTimeout(async () => {
    renderState(await getActiveTab());
    renderHistory();
  }, 250);
}

wireActions();
refresh();

// Cambio de pestaña activa.
chrome.tabs.onActivated.addListener(refresh);

// Navegación o recarga de la pestaña activa.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab?.active && (info.status || info.url)) refresh();
});

// Nuevas señales (estado por pestaña en session) o cambios de historial/whitelist.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" || changes.history || changes.whitelist) refresh();
});
