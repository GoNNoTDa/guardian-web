// Guardián de resultados de búsqueda (idea de Netcraft/WOT, pero local).
// En las páginas de resultados marca con un icono los enlaces cuyo dominio
// resulta sospechoso según señales LOCALES del background (feed de malware,
// IP pelada, TLD de riesgo, rastreador aprendido, dominio de minado).
// No consulta servicios externos por sí mismo: reutiliza rateHost del SW.

(() => {
  const alive = () => !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
  if (!alive()) return;

  const engineHost = location.hostname.replace(/^www\./, "");
  const processed = new WeakSet();

  const BADGE = {
    danger: { emoji: "🛑", color: "#c0392b", label: "Dominio peligroso (según Guardián Web)" },
    warn: { emoji: "⚠️", color: "#e67e22", label: "Dominio sospechoso (según Guardián Web)" },
  };

  function resultAnchors() {
    const out = [];
    for (const a of document.querySelectorAll('a[href^="http"]')) {
      if (processed.has(a)) continue;
      let h;
      try {
        h = new URL(a.href).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      // Saltar enlaces internos del propio buscador.
      if (!h || h === engineHost || h.endsWith("." + engineHost)) continue;
      if (/google|bing|duckduckgo|yahoo|brave|gstatic|googleusercontent/.test(h)) continue;
      out.push({ a, host: h });
    }
    return out;
  }

  function badge(anchor, kind) {
    if (anchor.querySelector(".__gw_badge")) return;
    const b = document.createElement("span");
    b.className = "__gw_badge";
    b.textContent = " " + BADGE[kind].emoji;
    b.title = BADGE[kind].label;
    b.style.cssText = `font-size:12px;cursor:help;`;
    anchor.appendChild(b);
  }

  async function scan() {
    if (!alive()) return;
    const items = resultAnchors();
    if (!items.length) return;
    items.forEach((it) => processed.add(it.a));

    const hosts = [...new Set(items.map((it) => it.host))];
    let ratings;
    try {
      const resp = await chrome.runtime.sendMessage({ type: "rate-hosts", hosts });
      ratings = resp && resp.ratings;
    } catch {
      return; // contexto invalidado
    }
    if (!ratings) return;

    for (const { a, host } of items) {
      const r = ratings[host];
      if (r === "danger" || r === "warn") badge(a, r);
    }
  }

  scan();
  let scheduled = false;
  const mo = new MutationObserver(() => {
    if (!alive()) {
      mo.disconnect();
      return;
    }
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scan();
      scheduled = false;
    }, 800);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
