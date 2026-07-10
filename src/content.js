// Content script (mundo aislado): capa de DOM.
// - Detecta typosquatting, homógrafos (punycode/confusables/leet), formularios
//   inseguros, texto de scam e iframes ocultos.
// - Recibe las señales del page-probe (mundo MAIN) y las reenvía al background.
// - Pinta el banner de aviso cuando el background emite un veredicto.
//
// v0.2: al arrancar pregunta al background el estado de confianza (A1):
// si el usuario ha marcado el sitio como fiable no hace NADA; si es un dominio
// de confianza embebido, no ejecuta heurísticas (solo muestra avisos
// confirmados por reputación). Marcas españolas ampliadas + homógrafos (A4).

(() => {
  // Objetivos de suplantación (marcas muy atacadas por phishing).
  const BRANDS = [
    // Globales
    "google.com", "youtube.com", "facebook.com", "instagram.com", "whatsapp.com",
    "microsoft.com", "outlook.com", "office.com", "apple.com", "icloud.com",
    "amazon.com", "amazon.es", "paypal.com", "netflix.com", "ebay.com",
    "booking.com", "linkedin.com", "telegram.org", "binance.com", "coinbase.com",
    "github.com", "dropbox.com",
    // Banca España
    "bbva.es", "santander.com", "bancosantander.es", "caixabank.es",
    "bancsabadell.com", "bankinter.com", "unicajabanco.es", "abanca.com",
    "ing.es", "openbank.es", "evobanco.com", "kutxabank.es", "ibercaja.es",
    "cajamar.es", "bizum.es", "ruralvia.com",
    // Administración España
    "agenciatributaria.gob.es", "sede.agenciatributaria.gob.es", "seg-social.es",
    "sepe.es", "dgt.es", "correos.es", "clave.gob.es",
    // Telecos / energía / comercio
    "movistar.es", "vodafone.es", "orange.es", "iberdrola.es", "endesa.com",
    "elcorteingles.es", "wallapop.com", "vinted.es", "renfe.com",
  ];

  // Dominios legítimos que se parecen a alguna marca (evita falsos positivos:
  // p. ej. ine.es está a distancia 1 de ing.es).
  const ALSO_LEGIT = [
    "ine.es", "boe.es", "abc.es", "as.com", "x.com", "ing.com", "orange.com",
    "orange.fr", "vodafone.com", "correos.cl", "renfe.es",
  ];

  // Caracteres visualmente idénticos o casi (cirílico/griego/leet) -> latino.
  const CONFUSABLES = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "һ": "h", "ԛ": "q", "ԝ": "w",
    "ν": "v", "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k", "ρ": "p",
    "τ": "t", "υ": "u", "ℓ": "l",
    "0": "o", "1": "l", "3": "e", "5": "s",
  };

  const seen = new Set();
  function add(f) {
    if (!f || seen.has(f.id)) return;
    seen.add(f.id);
    chrome.runtime.sendMessage({ type: "findings", findings: [f] }).catch(() => {});
  }

  // --- Arranque: preguntar al background si confiamos en este sitio ---------
  chrome.runtime.sendMessage({ type: "trust-status" }, (resp) => {
    if (chrome.runtime.lastError) resp = null;
    const status = resp || { trusted: false, whitelisted: false, verdict: null };
    if (status.whitelisted) return; // lista de confianza del usuario: silencio
    init(status);
  });

  function init(status) {
    // Avisos del background (pueden llegar en cualquier momento).
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "show-warning") renderBanner(msg.verdict);
    });

    // Carrera de arranque: si el background emitió el aviso antes de que este
    // script existiera, el veredicto llega en la respuesta y lo pintamos ya.
    if (status.verdict && status.verdict.level !== "safe") {
      renderBanner(status.verdict);
    }

    // Dominio de confianza embebido: sin heurísticas locales.
    if (status.trusted) return;

    runScans();

    // Reescaneo ante contenido dinámico (una pasada con retardo).
    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        runScans();
        scheduled = false;
      }, 1500);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Señales del page-probe (mundo MAIN).
    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data || e.data.__guardian !== true) return;
      add(e.data.finding);
    });
    // Pedir al probe lo que detectó antes de que existiéramos (corre en
    // document_start; nosotros en document_idle). El dedup por id evita
    // duplicados.
    window.postMessage({ __guardian_flush: true }, "*");

    // Vigilancia de exfiltración (A2): observar lo que el usuario teclea en
    // campos sensibles y pasárselo al probe para que vigile las salidas.
    watchSensitiveInputs();
  }

  // --- Exfiltración: recoger valores sensibles tecleados (A2) ---------------
  const SENSITIVE_NAME = /(pass|contrase|dni|nif|nie|iban|cuenta|tarjeta|card|cvv|cvc|telefono|phone|movil|email|correo|seguridad social|nuss)/i;
  function isSensitive(el) {
    const type = (el.type || "").toLowerCase();
    if (["password", "email", "tel"].includes(type)) return true;
    const meta = `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""} ${el.placeholder || ""}`;
    return SENSITIVE_NAME.test(meta);
  }
  function watchSensitiveInputs() {
    const values = new Map(); // elemento -> último valor
    const push = () => {
      const list = [...values.values()].filter((v) => v && v.length >= 5);
      window.postMessage({ __guardian_watch: true, values: list }, "*");
    };
    document.addEventListener(
      "input",
      (e) => {
        const el = e.target;
        if (!el || !("value" in el) || !isSensitive(el)) return;
        values.set(el, el.value);
        push();
      },
      true
    );
  }

  // --- Utilidades de dominio -------------------------------------------------
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[m][n];
  }

  // Decodificador punycode (RFC 3492) para etiquetas "xn--".
  function punyDecode(input) {
    try {
      const output = [];
      let n = 128, i = 0, bias = 72;
      let basic = input.lastIndexOf("-");
      if (basic < 0) basic = 0;
      for (let j = 0; j < basic; j++) output.push(input.charCodeAt(j));
      let index = basic > 0 ? basic + 1 : 0;
      while (index < input.length) {
        const oldi = i;
        for (let w = 1, k = 36; ; k += 36) {
          const c = input.charCodeAt(index++);
          const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : 36;
          i += digit * w;
          const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
          if (digit < t) break;
          w *= 36 - t;
        }
        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi === 0);
        n += Math.floor(i / out);
        i %= out;
        output.splice(i++, 0, n);
      }
      return String.fromCodePoint(...output);
    } catch {
      return input; // etiqueta corrupta: se deja tal cual
    }
  }
  function adapt(delta, numPoints, firstTime) {
    delta = firstTime ? Math.floor(delta / 700) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > 455) {
      delta = Math.floor(delta / 35);
      k += 36;
    }
    return k + Math.floor((36 * delta) / (delta + 38));
  }

  function normalizeConfusables(s) {
    return s.split("").map((c) => CONFUSABLES[c] || c).join("");
  }

  // Nombre registrable aproximado: penúltima etiqueta, saltando sufijos
  // compuestos tipo .gob.es / .com.mx (etiquetas de <=3 caracteres).
  function sld(h) {
    const parts = h.split(".");
    let i = parts.length - 2;
    while (i > 0 && parts[i].length <= 3) i--;
    return parts[Math.max(i, 0)];
  }

  // --- 1) Suplantación de dominio: homógrafos + typosquatting ---------------
  function checkDomain() {
    const rawHost = location.hostname.replace(/^www\./, "").toLowerCase();

    // ¿Es directamente un dominio legítimo conocido?
    for (const b of [...BRANDS, ...ALSO_LEGIT]) {
      if (rawHost === b || rawHost.endsWith("." + b)) return;
    }

    // Decodificar punycode y normalizar caracteres confundibles.
    const uniHost = rawHost
      .split(".")
      .map((l) => (l.startsWith("xn--") ? punyDecode(l.slice(4)) : l))
      .join(".");
    const normHost = normalizeConfusables(uniHost);

    // Homógrafo: tras normalizar, coincide EXACTAMENTE con una marca.
    if (normHost !== rawHost) {
      for (const b of BRANDS) {
        if (normHost === b || normHost.endsWith("." + b)) {
          add({
            id: `homograph:${b}`,
            weight: 80,
            category: "phishing",
            title: "Dominio homógrafo (caracteres que engañan a la vista)",
            detail: `"${rawHost}" usa caracteres visualmente idénticos para imitar a "${b}".`,
          });
          return;
        }
      }
    }

    // Typosquatting clásico por distancia de edición.
    for (const b of BRANDS) {
      if (b.length < 6) continue; // marcas muy cortas: demasiado falso positivo
      // Misma marca con otra terminación (p. ej. agenciatributaria.com):
      // señal real pero más débil, porque a veces es la propia empresa.
      if (sld(rawHost) === sld(b)) {
        add({
          id: `other-tld:${b}`,
          weight: 30,
          category: "phishing",
          title: "Nombre de marca con otra terminación",
          detail: `"${rawHost}" usa el nombre de "${b}" con distinto dominio de nivel superior.`,
        });
        return;
      }
      const maxDist = b.length >= 10 ? 2 : 1;
      const dist = levenshtein(rawHost, b);
      if (dist > 0 && dist <= maxDist && Math.abs(rawHost.length - b.length) <= maxDist) {
        add({
          id: `typo:${b}`,
          weight: 60,
          category: "phishing",
          title: "Posible suplantación de marca (typosquatting)",
          detail: `"${rawHost}" se parece muchísimo a "${b}". Podría ser un clon fraudulento.`,
        });
        return;
      }
    }
  }

  // --- 2) Formularios con contraseña: sin cifrar o enviados a otro dominio --
  function scanForms() {
    const host = location.hostname.replace(/^www\./, "");
    document.querySelectorAll("form").forEach((form) => {
      if (!form.querySelector('input[type="password"]')) return;
      let actionUrl;
      try {
        actionUrl = new URL(form.getAttribute("action") || location.href, location.href);
      } catch {
        return;
      }
      if (location.protocol === "http:" || actionUrl.protocol === "http:") {
        add({
          id: "pwd-http",
          weight: 50,
          category: "phishing",
          title: "Contraseña que viaja sin cifrar (HTTP)",
          detail: "Un formulario de acceso no usa HTTPS: tus credenciales viajarían en claro.",
        });
      }
      const actionHost = actionUrl.hostname.replace(/^www\./, "");
      if (actionHost && actionHost !== host && !actionHost.endsWith("." + host)) {
        add({
          id: `pwd-cross:${actionHost}`,
          weight: 35,
          category: "phishing",
          title: "El login se envía a otro dominio",
          detail: `El formulario manda tus credenciales a ${actionHost}, distinto del sitio actual.`,
        });
      }
    });
  }

  // --- 3) Texto típico de estafa / soporte técnico falso ---------------------
  const SCAM_PATTERNS = [
    /su (ordenador|equipo|pc) (está|ha sido) infectad/i,
    /virus (detectad|encontrad)/i,
    /llame (ahora|inmediatamente|ya) al/i,
    /soporte técnico de (microsoft|windows|apple)/i,
    /your (computer|pc) (is|has been) infected/i,
    /call .{0,25}(microsoft|apple|support|technician)/i,
    /ha (ganado|sido seleccionad).{0,30}(premio|iphone|tarjeta|regalo)/i,
  ];
  function scanScam() {
    const text = (document.body?.innerText || "").slice(0, 20000);
    if (SCAM_PATTERNS.some((re) => re.test(text))) {
      add({
        id: "scam-text",
        weight: 45,
        category: "scam",
        title: "Mensaje típico de estafa / soporte falso",
        detail: "La página muestra texto alarmista característico de fraudes de soporte técnico.",
      });
    }
  }

  // --- 4) Iframes invisibles (posible clickjacking) --------------------------
  function scanIframes() {
    let hidden = 0;
    document.querySelectorAll("iframe").forEach((f) => {
      const s = getComputedStyle(f);
      const r = f.getBoundingClientRect();
      if (s.opacity === "0" || s.visibility === "hidden" || r.width <= 1 || r.height <= 1) hidden++;
    });
    if (hidden >= 2) {
      add({
        id: "hidden-iframes",
        weight: 25,
        category: "scam",
        title: "Iframes ocultos (posible clickjacking)",
        detail: `${hidden} iframes invisibles superpuestos: podrían capturar tus clics.`,
      });
    }
  }

  function runScans() {
    checkDomain();
    scanForms();
    scanScam();
    scanIframes();
  }

  // --- Banner de aviso (Shadow DOM para aislar estilos) -----------------------
  function renderBanner(verdict) {
    if (document.getElementById("__guardian_banner")) return;
    const wrap = document.createElement("div");
    wrap.id = "__guardian_banner";
    const shadow = wrap.attachShadow({ mode: "open" });
    const danger = verdict.level === "danger";
    const top = verdict.reasons[0];

    shadow.innerHTML = `
      <style>
        .bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
          font: 14px/1.4 system-ui, sans-serif; color: #fff; padding: 12px 16px;
          display: flex; align-items: center; gap: 12px;
          background: ${danger ? "#c0392b" : "#e67e22"};
          box-shadow: 0 2px 10px rgba(0,0,0,.3); }
        .ico { font-size: 20px; }
        .txt { flex: 1; }
        .txt b { font-size: 15px; }
        .txt small { opacity: .9; }
        button { background: rgba(255,255,255,.2); color: #fff; border: 1px solid rgba(255,255,255,.5);
          border-radius: 6px; padding: 6px 12px; cursor: pointer; font: inherit; }
        button:hover { background: rgba(255,255,255,.35); }
        ul { margin: 8px 0 0; padding-left: 18px; display: none; }
        .bar.open ul { display: block; }
        .head { display: flex; align-items: center; gap: 12px; }
        .body { width: 100%; }
      </style>
      <div class="bar">
        <div class="body">
          <div class="head">
            <span class="ico">${danger ? "🛑" : "⚠️"}</span>
            <span class="txt">
              <b>Guardián Web: ${danger ? "sitio potencialmente peligroso" : "actividad sospechosa"}</b><br>
              <small>${top ? escapeHtml(top.title) : "Se han detectado señales de riesgo."} (riesgo ${verdict.score})</small>
            </span>
            <button class="details">Ver detalles</button>
            <button class="trust" title="No volver a avisar en este sitio">Confiar en este sitio</button>
            <button class="close">Cerrar</button>
          </div>
          <ul>${verdict.reasons
            .map((r) => `<li><b>${escapeHtml(r.title)}</b> — ${escapeHtml(r.detail)}</li>`)
            .join("")}</ul>
        </div>
      </div>`;

    const bar = shadow.querySelector(".bar");
    shadow.querySelector(".details").addEventListener("click", () => bar.classList.toggle("open"));
    shadow.querySelector(".close").addEventListener("click", () => wrap.remove());
    shadow.querySelector(".trust").addEventListener("click", () => {
      chrome.runtime
        .sendMessage({ type: "trust-host", host: location.hostname })
        .catch(() => {})
        .finally(() => wrap.remove());
    });
    document.documentElement.appendChild(wrap);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
})();
