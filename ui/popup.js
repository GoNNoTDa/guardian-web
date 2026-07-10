// Popup: vista rápida de la pestaña activa + acceso al panel lateral.

import { getActiveTab, renderState, renderHistory, wireActions } from "./render.js";
import { localizePage } from "./i18n.js";

localizePage();
const tab = await getActiveTab();
renderState(tab);
renderHistory();
wireActions();

// Abrir el panel lateral (anclado a la derecha) y cerrar el popup.
document.getElementById("openPanel").addEventListener("click", async () => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch {
    /* Chrome < 114 o panel no disponible: el popup sigue funcionando */
  }
});
