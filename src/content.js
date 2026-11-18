// Content script (mundo aislado): capa de DOM.
// - Detecta formularios inseguros, marcas suplantadas con login, ventanas de
//   navegador falsas, texto de scam, iframes ocultos, SVG con código…
// - Recibe las señales del page-probe (mundo MAIN) y las reenvía al background.
// - Pinta el banner de aviso cuando el background emite un veredicto, y lo
//   actualiza si el riesgo sube.
//
// v0.2: al arrancar pregunta al background el estado de confianza (A1):
// si el usuario ha marcado el sitio como fiable no hace NADA; si es un dominio
// de confianza embebido, no ejecuta heurísticas (solo muestra avisos
// confirmados por reputación).
// v0.8: el análisis del NOMBRE del dominio (homógrafos, typosquatting) se ha
// ido al service worker (lib/lookalike.js): no necesita el DOM y así avisa
// antes. Los escaneos del DOM se espacian en páginas que mutan sin parar.

(() => {
  // Si la extensión se recarga/actualiza, este script queda "huérfano": las
  // APIs chrome.* desaparecen bajo sus pies. alive() lo detecta para apagarse
  // con elegancia en vez de lanzar TypeErrors en páginas SPA que mutan mucho.
  const alive = () => !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);

  const t = (key, subs) => {
    try {
      return chrome.i18n.getMessage(key, subs) || key;
    } catch {
      return key; // contexto invalidado: se degrada a la clave, sin romper
    }
  };

  // Señales que puede emitir el page-probe. El canal postMessage con el mundo
  // MAIN lo puede imitar cualquier script de la página, así que de ahí solo se
  // acepta el id (y un parámetro de texto): el peso, la categoría y los textos
  // salen SIEMPRE de esta tabla. Un id desconocido se descarta, lo que impide
  // inventarse señales con peso negativo o adelantarse a los ids de otros
  // detectores para anularlos.
  const PROBE_FINDINGS = {
    "fp-canvas": { weight: 20, category: "privacy", key: "fCanvas" },
    "fp-mining": { weight: 40, category: "malware", key: "fWasm" },
    "perm-notif": { weight: 15, category: "scam", key: "fPermNotif" },
    "perm-geo": { weight: 20, category: "privacy", key: "fPermGeo" },
    "notifbait:sw": { weight: 25, category: "scam", key: "fNotifSw" },
    "locker:history": { weight: 45, category: "scam", key: "fLockerHistory" },
    "locker:fullscreen": { weight: 25, category: "scam", key: "fLockerFs" },
    "clickfix:pad": { weight: 60, category: "scam", key: "fClickfixPad" },
    "clickfix:cmd": { weight: 45, category: "scam", key: "fClickfixCmd" },
    "clipswap:account": { weight: 70, category: "scam", key: "fClipSwapAccount" },
    clipswap: { weight: 45, category: "scam", key: "fClipSwap" },
    smuggling: { weight: 45, category: "malware", key: "fSmuggling", param: true },
    "web3:ethsign": { weight: 70, category: "phishing", key: "fWeb3Sign" },
    "web3:approvalall": { weight: 70, category: "phishing", key: "fWeb3ApprovalAll" },
    "web3:unlimited": { weight: 70, category: "phishing", key: "fWeb3Unlimited" },
    "web3:permit": { weight: 50, category: "phishing", key: "fWeb3Permit" },
    // Llevan el host de destino en el id ("exfil:evil.com").
    exfil: { weight: 70, category: "privacy", key: "fExfil", param: true, perHost: true },
    skimmer: { weight: 90, category: "malware", key: "fSkimmer", param: true, perHost: true },
  };

  function fromProbe(raw) {
    if (!raw || typeof raw.id !== "string") return null;
    const base = raw.id.split(":")[0];
    const spec = PROBE_FINDINGS[raw.id] || (PROBE_FINDINGS[base]?.perHost ? PROBE_FINDINGS[base] : null);
    if (!spec) return null;
    const params = [];
    if (spec.param) {
      const p = Array.isArray(raw.params) ? String(raw.params[0] ?? "").slice(0, 100) : "";
      if (!p) return null;
      params.push(p);
    }
    return {
      id: spec.perHost ? `${base}:${params[0]}` : raw.id,
      weight: spec.weight,
      category: spec.category,
      title: t(`${spec.key}Title`, params),
      detail: t(`${spec.key}Detail`, params),
    };
  }

  const seen = new Set();
  function add(f) {
    if (!f || seen.has(f.id) || !alive()) return;
    seen.add(f.id);
    try {
      chrome.runtime.sendMessage({ type: "findings", findings: [f] }).catch(() => {});
    } catch {
      /* contexto invalidado entre el check y el envío: ignorar */
    }
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

    // Reescaneo ante contenido dinámico. Las primeras pasadas van seguidas,
    // porque la página se está montando; después se espacian: una SPA que muta
    // sin parar (un chat, un feed) no puede tenernos leyendo todo su texto y
    // sus estilos cada segundo y medio. En segundo plano no se escanea: se
    // apunta y se hace una pasada al volver.
    let timer = null;
    let passes = 0;
    let owed = false;
    const idle = (fn) =>
      typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 0);
    const pass = () => {
      if (!alive()) return;
      if (document.hidden) {
        owed = true;
        return;
      }
      owed = false;
      passes++;
      idle(runScans);
    };
    const mo = new MutationObserver(() => {
      // Script huérfano (extensión recargada): desconectar y no hacer nada más.
      if (!alive()) {
        mo.disconnect();
        return;
      }
      if (timer) return;
      const delay = passes < 4 ? 1500 : passes < 10 ? 4000 : 10000;
      timer = setTimeout(() => {
        timer = null;
        pass();
      }, delay);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && owed) pass();
    });

    // Señales del page-probe (mundo MAIN).
    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data || e.data.__guardian !== true) return;
      const f = fromProbe(e.data.finding);
      if (!f) return;
      add(f);
      // El permiso puede pedirse mucho después de nuestro escaneo del DOM, así
      // que el señuelo se comprueba también en cuanto llega esa señal.
      if (f.id === "perm-notif") {
        notifPedido = true;
        scanNotifBait();
      }
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
  const CARD_NAME = /(tarjeta|card|cc-number|cardnumber|numero.?tarjeta|pan)/i;
  function isSensitive(el) {
    const type = (el.type || "").toLowerCase();
    if (["password", "email", "tel"].includes(type)) return true;
    const meta = `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""} ${el.placeholder || ""}`;
    return SENSITIVE_NAME.test(meta);
  }
  // Comprobación de Luhn: valida números de tarjeta reales (13-19 dígitos).
  function looksLikeCard(el, value) {
    const digits = (value || "").replace(/[\s-]/g, "");
    if (!/^\d{13,19}$/.test(digits)) return false;
    const meta = `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""} ${el.placeholder || ""}`;
    if (!CARD_NAME.test(meta) && (el.autocomplete || "") !== "cc-number") {
      // Sin pista de que sea tarjeta: solo cuenta si pasa Luhn (evita DNIs, etc.).
    }
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }
  function watchSensitiveInputs() {
    const values = new Map(); // elemento -> último valor
    const cards = new Map(); // elemento -> valor si parece tarjeta
    const push = () => {
      const list = [...values.values()].filter((v) => v && v.length >= 5);
      const cardList = [...cards.values()].filter((v) => v && v.length >= 5);
      window.postMessage({ __guardian_watch: true, values: list, cards: cardList }, "*");
    };
    document.addEventListener(
      "input",
      (e) => {
        const el = e.target;
        if (!el || !("value" in el)) return;
        const card = looksLikeCard(el, el.value);
        if (!isSensitive(el) && !card) return;
        values.set(el, el.value);
        if (card) cards.set(el, el.value.replace(/[\s-]/g, ""));
        push();
      },
      true
    );
  }

  // --- Utilidades de dominio -------------------------------------------------
  // Nombre registrable: la etiqueta anterior al TLD, o al sufijo de segundo
  // nivel bajo un TLD de país (.gob.es, .co.uk). Misma regla que
  // lib/domain.js; aquí no se puede importar (los content scripts no son
  // módulos), así que hay un test que comprueba que las dos coinciden.
  const SECOND_LEVEL = new Set([
    "co", "com", "gob", "gov", "org", "net", "edu", "ac", "nom", "or", "ne", "go", "mil", "gv",
  ]);
  function sld(h) {
    const parts = h.split(".");
    if (parts.length <= 2) return parts[0];
    const tld = parts[parts.length - 1];
    const keep = tld.length === 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 3 : 2;
    return parts[parts.length - keep];
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
          title: t("fPwdHttpTitle"),
          detail: t("fPwdHttpDetail"),
        });
      }
      const actionHost = actionUrl.hostname.replace(/^www\./, "");
      if (actionHost && actionHost !== host && !actionHost.endsWith("." + host)) {
        add({
          id: `pwd-cross:${actionHost}`,
          weight: 35,
          category: "phishing",
          title: t("fPwdCrossTitle"),
          detail: t("fPwdCrossDetail", [actionHost]),
        });
      }
    });
  }

  // --- 2b) Marca conocida + contraseña en un dominio que no es el suyo -------
  // El detector de typosquatting mira el DOMINIO; este mira lo que la página
  // DICE SER. Es el patrón de las campañas que avisa el INCIBE: un dominio sin
  // ninguna relación ("verificacion-cliente-2026.top") clona la web del banco
  // con su logo y su título y pide las credenciales. Ahí no hay parecido
  // tipográfico que detectar: el engaño está en el contenido.
  //
  // El nombre de la marca se busca solo en la CABECERA de la página (título,
  // og:site_name, h1 y el alt del logo), nunca en todo el texto: así un
  // comparador de hipotecas, un periódico o un foro que mencionen al banco no
  // se marcan. Los dominios propios de cada marca se comprueban por nombre
  // registrable, de modo que login.caixabank.es no salta y caixabank-seguro.top
  // sí. Las marcas con nombre ambiguo (Santander es una ciudad, Correos una
  // palabra común, Apple una fruta) exigen además contexto de acceso.
  const BRAND_CONTEXT =
    /banca|banco|bank|acceso|access|cliente|client|particular|empresa|sede|electr[óo]nic|cuenta|account|sign[ -]?in|log[ -]?in|login|contrase|password|identif|verific/i;
  const BRAND_IDENTITIES = [
    // Banca y administración españolas: el foco del proyecto.
    { label: "CaixaBank", re: /\bcaixabank\b|\bla caixa\b/i, slds: ["caixabank", "lacaixa", "caixabanknow", "imaginbank"] },
    { label: "BBVA", re: /\bbbva\b/i, slds: ["bbva"] },
    { label: "Banco Santander", re: /\bsantander\b/i, slds: ["santander", "bancosantander"], strict: true },
    { label: "Banco Sabadell", re: /\bban[cq]o? sabadell\b|\bbancsabadell\b/i, slds: ["bancsabadell", "bancosabadell"] },
    { label: "Bankinter", re: /\bbankinter\b/i, slds: ["bankinter"] },
    { label: "Unicaja", re: /\bunicaja\b/i, slds: ["unicajabanco", "unicaja"] },
    { label: "Abanca", re: /\babanca\b/i, slds: ["abanca"] },
    { label: "ING", re: /\bing direct\b|\bing\.es\b/i, slds: ["ing"] },
    { label: "Openbank", re: /\bopenbank\b/i, slds: ["openbank"] },
    { label: "Kutxabank", re: /\bkutxabank\b/i, slds: ["kutxabank"] },
    { label: "Ibercaja", re: /\bibercaja\b/i, slds: ["ibercaja"] },
    { label: "Cajamar", re: /\bcajamar\b/i, slds: ["cajamar"] },
    { label: "EVO Banco", re: /\bevo banco\b/i, slds: ["evobanco"] },
    { label: "Bizum", re: /\bbizum\b/i, slds: ["bizum"] },
    { label: "Ruralvía", re: /\bruralv[ií]a\b/i, slds: ["ruralvia"] },
    { label: "Agencia Tributaria", re: /\bagencia tributaria\b/i, slds: ["agenciatributaria"] },
    { label: "Seguridad Social", re: /\bseguridad social\b|\bimport@ss\b/i, slds: ["seg-social", "segsocial"] },
    { label: "SEPE", re: /\bsepe\b/i, slds: ["sepe"] },
    { label: "DGT", re: /\bdgt\b|\bdirecci[óo]n general de tr[áa]fico\b/i, slds: ["dgt"], strict: true },
    { label: "Correos", re: /\bcorreos\b(?!\s*electr)/i, slds: ["correos"], strict: true },
    { label: "Cl@ve", re: /\bcl@ve\b/i, slds: ["clave"] },
    // Marcas globales entre las más suplantadas del mundo.
    { label: "Microsoft", re: /\bmicrosoft\b|\boffice ?365\b/i, slds: ["microsoft", "microsoftonline", "office", "live"] },
    { label: "Outlook", re: /\boutlook\b/i, slds: ["outlook", "live", "microsoft", "office"] },
    { label: "Google", re: /\bgoogle\b/i, slds: ["google", "googlemail"] },
    { label: "Apple", re: /\bapple\b|\bicloud\b/i, slds: ["apple", "icloud"], strict: true },
    { label: "Amazon", re: /\bamazon\b/i, slds: ["amazon"] },
    { label: "PayPal", re: /\bpaypal\b/i, slds: ["paypal"] },
    { label: "Netflix", re: /\bnetflix\b/i, slds: ["netflix"] },
    { label: "Facebook", re: /\bfacebook\b/i, slds: ["facebook", "meta"] },
    { label: "Instagram", re: /\binstagram\b/i, slds: ["instagram"] },
    { label: "WhatsApp", re: /\bwhatsapp\b/i, slds: ["whatsapp"] },
    { label: "LinkedIn", re: /\blinkedin\b/i, slds: ["linkedin"] },
    { label: "Binance", re: /\bbinance\b/i, slds: ["binance"] },
    { label: "Coinbase", re: /\bcoinbase\b/i, slds: ["coinbase"] },
    { label: "Movistar", re: /\bmovistar\b/i, slds: ["movistar", "telefonica"] },
    { label: "Vodafone", re: /\bvodafone\b/i, slds: ["vodafone"] },
    { label: "Endesa", re: /\bendesa\b/i, slds: ["endesa"] },
    { label: "Iberdrola", re: /\biberdrola\b/i, slds: ["iberdrola"] },
    { label: "El Corte Inglés", re: /\bel corte ingl[ée]s\b/i, slds: ["elcorteingles"] },
    { label: "Wallapop", re: /\bwallapop\b/i, slds: ["wallapop"] },
    { label: "Vinted", re: /\bvinted\b/i, slds: ["vinted"] },
    { label: "Renfe", re: /\brenfe\b/i, slds: ["renfe"] },
    { label: "Booking.com", re: /\bbooking\.com\b/i, slds: ["booking"] },
    { label: "Telegram", re: /\btelegram\b/i, slds: ["telegram", "t"], strict: true },
    { label: "Dropbox", re: /\bdropbox\b/i, slds: ["dropbox"] },
    { label: "GitHub", re: /\bgithub\b/i, slds: ["github"] },
  ];

  // "Cabecera" de la página: lo que la web declara ser. Del alt de las imágenes
  // solo se toman los logos (cabecera, navegación o un alt/clase que lo diga):
  // el alt de un banner publicitario cualquiera no debe contar como identidad.
  function headline() {
    const parts = [document.title || ""];
    const meta = document.querySelector('meta[property="og:site_name"], meta[name="application-name"]');
    if (meta) parts.push(meta.getAttribute("content") || "");
    document.querySelectorAll("h1").forEach((h) => parts.push(h.innerText || ""));
    document
      .querySelectorAll(
        'header img[alt], nav img[alt], img[alt*="logo" i], img[class*="logo" i][alt],' +
          ' img[id*="logo" i][alt], img[src*="logo" i][alt], [aria-label*="logo" i]'
      )
      .forEach((el) => parts.push(el.getAttribute("alt") || el.getAttribute("aria-label") || ""));
    return parts.join(" · ").slice(0, 2000);
  }

  let brandFormDone = false;
  function scanBrandForm() {
    if (brandFormDone) return;
    // Debe haber un campo de contraseña VISIBLE: un registro colapsado o un
    // login escondido en el pie no son una pantalla de credenciales.
    const pwd = [...document.querySelectorAll('input[type="password"]')].find(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0
    );
    if (!pwd) return;

    const host = location.hostname.replace(/^www\./, "").toLowerCase();
    const hostSld = sld(host);
    const head = headline();
    for (const b of BRAND_IDENTITIES) {
      if (!b.re.test(head)) continue;
      if (b.slds.includes(hostSld)) continue; // es su web de verdad
      if (b.strict && !BRAND_CONTEXT.test(head)) continue;
      brandFormDone = true;
      add({
        id: `brandform:${b.label}`,
        weight: 60,
        category: "phishing",
        title: t("fBrandFormTitle", [b.label]),
        detail: t("fBrandFormDetail", [b.label, host]),
      });
      return; // con una marca suplantada basta
    }
  }

  // --- 2d) Browser-in-the-Browser: ventana de navegador falsa ---------------
  // La página dibuja con HTML lo que parece una ventana emergente del navegador
  // —con su barra de direcciones y sus botones— y dentro pide las credenciales.
  // La barra es un div: se puede escribir cualquier cosa en ella. Ninguna web
  // honesta tiene motivo para dibujar una barra de direcciones.
  //
  // Se exigen tres cosas a la vez, porque por separado cada una es común:
  //   1. un texto que es SOLO una URL (no prosa que la mencione) de OTRO dominio
  //   2. dentro del mismo marco, un campo de contraseña o un iframe
  //   3. el marco parece una ventana (sombra y esquinas, o botones de ventana) y
  //      la supuesta barra de direcciones está en su parte superior
  const URL_ONLY = /\bhttps?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i;
  const WINDOW_BUTTONS = /[✕✖×⨯🗙⊗]|[–—]\s*□|□\s*[✕✖×]/;
  let fakeWindowDone = false;
  function scanFakeWindow() {
    if (fakeWindowDone) return;
    const pageHost = location.hostname.replace(/^www\./, "").toLowerCase();
    const candidatos = [];
    const anotar = (el, texto) => {
      const t = (texto || "").trim();
      if (!t || t.length > 120) return;
      const m = URL_ONLY.exec(t);
      // La URL debe ser casi todo el contenido: una barra de direcciones no
      // lleva prosa alrededor ("visita https://x.com para más información").
      if (!m || t.length > m[0].length + 25) return;
      const host = m[1].replace(/^www\./, "").toLowerCase();
      if (host === pageHost || host.endsWith("." + pageHost)) return; // su propia URL
      candidatos.push({ el, host });
    };
    // Los kits usan tanto un input de solo lectura como un div de texto.
    document.querySelectorAll("input[readonly], input[disabled]").forEach((el) => anotar(el, el.value));
    const hojas = document.querySelectorAll("div, span, p, code, small, label, td, li, b, strong");
    for (let i = 0; i < hojas.length && i < 2500 && candidatos.length < 10; i++) {
      if (!hojas[i].children.length) anotar(hojas[i], hojas[i].textContent);
    }

    for (const { el, host } of candidatos) {
      let marco = el.parentElement;
      for (let nivel = 0; marco && nivel < 6; nivel++, marco = marco.parentElement) {
        if (!marco.querySelector('input[type="password"]') && !marco.querySelector("iframe")) continue;
        const s = getComputedStyle(marco);
        const rMarco = marco.getBoundingClientRect();
        const rUrl = el.getBoundingClientRect();
        if (rMarco.height < 80) continue;
        // La barra de direcciones falsa va arriba, como en una ventana real.
        if (rUrl.top - rMarco.top > rMarco.height * 0.35) continue;
        const sombra = s.boxShadow && s.boxShadow !== "none";
        const esquinas = (parseFloat(s.borderTopLeftRadius) || 0) >= 4;
        const botones =
          WINDOW_BUTTONS.test(marco.textContent.slice(0, 400)) ||
          !!marco.querySelector('[aria-label*="close" i], [class*="titlebar" i], [class*="window-controls" i]');
        if (!((sombra && esquinas) || botones)) continue;
        fakeWindowDone = true;
        add({
          id: `fakewindow:${host}`,
          weight: 70,
          category: "phishing",
          title: t("fFakeWindowTitle"),
          detail: t("fFakeWindowDetail", [host]),
        });
        return;
      }
    }
  }

  // --- 2c) Petición de la frase de recuperación de una cartera --------------
  // Ninguna web, servicio o soporte legítimo pide nunca la frase semilla: quien
  // la tiene se lleva los fondos, sin más. De ahí el peso alto.
  //
  // La expresión exige "frase" + "recuperación/semilla" juntas (o "mnemonic"),
  // nunca "recovery" a secas: un campo «correo de recuperación» o «código de
  // recuperación» es de lo más normal y no tiene nada que ver.
  const SEED_RE =
    /(frase (de )?(recuperaci[óo]n|semilla|secreta)|frase semilla|palabras de recuperaci[óo]n|seed phrase|recovery phrase|secret phrase|mnemonic|1[28][ -]?(palabras|words)|24[ -]?(palabras|words))/i;
  function scanSeedPhrase(pageText) {
    if (seen.has("seedphrase")) return;
    const fields = [...document.querySelectorAll("input, textarea")].filter(
      (el) => !/^(hidden|checkbox|radio|submit|button|file|range|color|image|reset)$/i.test(el.type || "")
    );
    if (!fields.length) return;

    // Camino 1: el propio campo se identifica como la frase de recuperación. Se
    // mira solo la etiqueta del campo (placeholder, name, id, aria-label y su
    // <label>), nunca el texto de la página: un artículo que explica qué es una
    // frase semilla no tiene un campo llamado así.
    const etiqueta = (el) => {
      let asociada = "";
      try {
        if (el.labels) asociada = [...el.labels].map((l) => l.textContent || "").join(" ");
      } catch {
        /* labels no disponible en algún elemento exótico */
      }
      return [el.placeholder, el.name, el.id, el.getAttribute("aria-label"), asociada].join(" ");
    };
    const campoDirecto = fields.some((el) => SEED_RE.test(etiqueta(el)));

    // Camino 2: la rejilla de 12/24 casillas que imita la pantalla de
    // restauración de una cartera, con el vocabulario en la página.
    const rejilla = fields.length >= 12 && SEED_RE.test(pageText());

    if (!campoDirecto && !rejilla) return;
    add({
      id: "seedphrase",
      weight: 90,
      category: "phishing",
      title: t("fSeedTitle"),
      detail: t("fSeedDetail"),
    });
  }

  // --- 2g) Señuelo para que aceptes las notificaciones ----------------------
  // «Haz clic en Permitir para ver el vídeo»: el reproductor falso que convierte
  // el permiso de notificaciones en un canal de avisos fraudulentos (falsos
  // virus, paquetes retenidos, sorteos) que siguen llegando con la página ya
  // cerrada. Se exige que la web haya PEDIDO el permiso además de mostrar el
  // señuelo, porque el texto por sí solo lo tiene cualquier artículo que explique
  // esta estafa.
  const ALLOW_BAIT = [
    /(pulsa|haz clic|clica|dale)[^.]{0,20}«?permitir»?/i,
    /permitir[^.]{0,25}para (continuar|ver|acceder|descargar|reproducir)/i,
    /acepta[^.]{0,20}notificaciones[^.]{0,20}para (continuar|ver|acceder)/i,
    /click[^.]{0,15}«?allow»?/i,
    /press[^.]{0,10}allow/i,
    /tap[^.]{0,10}allow/i,
    /allow[^.]{0,25}to (continue|watch|view|access|download|play)/i,
    /allow notifications to (continue|watch|view|access)/i,
  ];
  let notifPedido = false;
  let baitAvisado = false;
  function scanNotifBait(pageText = readPageText) {
    if (baitAvisado || !notifPedido) return;
    const texto = pageText();
    if (!ALLOW_BAIT.some((re) => re.test(texto))) return;
    baitAvisado = true;
    add({
      id: "notifbait",
      weight: 40,
      category: "scam",
      title: t("fNotifBaitTitle"),
      detail: t("fNotifBaitDetail"),
    });
  }

  // --- 2f) SVG con JavaScript dentro ----------------------------------------
  // Un SVG es un documento XML, no una imagen tonta: puede llevar <script>. Los
  // adjuntos SVG maliciosos se multiplicaron por cincuenta en un año, porque
  // pasan los filtros de correo como si fueran imágenes y, al abrirlos en el
  // navegador, montan una página de login falsa o redirigen a una.
  //
  // Importante: <img src="x.svg"> NO ejecuta scripts, así que no se marca. Sí
  // los ejecutan el SVG en línea, y los SVG cargados por object/embed/iframe.
  function scanSvgScript() {
    // 1) El documento que estás viendo ES un SVG y trae código. Nadie manda
    //    gráficos con JavaScript dentro: es el caso del adjunto malicioso.
    const raiz = document.documentElement;
    if (raiz && raiz.tagName && raiz.tagName.toLowerCase() === "svg") {
      if (raiz.querySelector("script") || raiz.querySelector("[*|href^='javascript:']")) {
        add({
          id: "svgscript:document",
          weight: 70,
          category: "malware",
          title: t("fSvgDocTitle"),
          detail: t("fSvgDocDetail"),
        });
        return;
      }
    }

    // 2) SVG en línea con <script> dentro. Los SVG de iconos no llevan código.
    if (document.querySelector("svg script")) {
      add({
        id: "svgscript:inline",
        weight: 45,
        category: "malware",
        title: t("fSvgInlineTitle"),
        detail: t("fSvgInlineDetail"),
      });
    }

    // 3) SVG de otro dominio cargado de una forma que SÍ ejecuta su código.
    const pageHost = location.hostname.replace(/^www\./, "").toLowerCase();
    const marcos = document.querySelectorAll("object[data], embed[src], iframe[src]");
    for (let i = 0; i < marcos.length && i < 200; i++) {
      const el = marcos[i];
      const bruto = el.getAttribute("data") || el.getAttribute("src") || "";
      let u;
      try {
        u = new URL(bruto, location.href);
      } catch {
        continue;
      }
      if (!/\.svgz?($|[?#])/i.test(u.pathname + u.search)) continue;
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (!host || host === pageHost || host.endsWith("." + pageHost)) continue;
      add({
        id: `svgscript:embed:${host}`,
        weight: 45,
        category: "malware",
        title: t("fSvgEmbedTitle"),
        detail: t("fSvgEmbedDetail", [host]),
      });
      return;
    }
  }

  // --- 2e) Instrucciones ocultas dirigidas a una IA -------------------------
  // Vector nuevo de 2026: la página esconde texto que tú no ves pero que sí lee
  // un agente de IA (o el chatbot al que le pegas la página), con órdenes del
  // tipo «ignora las instrucciones anteriores» o «no se lo digas al usuario».
  // Se ha visto usado para colar estafas de pago y para sacar el historial de
  // conversación de agentes que navegan solos.
  //
  // Se exige que el texto esté OCULTO y que tenga forma de instrucción a un
  // modelo: cada cosa por separado es corriente (hay mucho texto oculto
  // legítimo, y mucha página que habla de IA a la vista).
  const PROMPT_PATTERNS = [
    /ignore (all |any )?(previous|prior|above|earlier)[^.]{0,20}instructions?/i,
    /disregard (all |any )?(previous|prior|above|earlier)/i,
    /ignora (todas )?(las )?instrucciones (anteriores|previas)/i,
    /olvida (todas )?(las )?instrucciones/i,
    /you are (now )?(an?|the) (ai|assistant|language model|llm|agent)\b/i,
    /eres (ahora )?(un|una) (asistente|ia|modelo de lenguaje|agente)\b/i,
    /\b(system|developer) prompt\b/i,
    /\bprompt (del )?sistema\b/i,
    /as an ai (language )?(model|assistant)/i,
    /do not (tell|inform|reveal|mention)[^.]{0,25}(user|human)/i,
    /no (le )?(digas|informes|reveles|menciones)[^.]{0,25}(usuario|humano)/i,
    /\bnew instructions?\s*:/i,
    /\bnuevas instrucciones\s*:/i,
    /when (you )?(summariz|asked)[^.]{0,40}(instead|reply with|responde)/i,
  ];
  const SKIP_HIDDEN = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "TITLE"]);

  // ¿Está este texto fuera de la vista del usuario? Se comprueba sobre el
  // elemento que lo contiene, con las formas que usan estas campañas.
  function estaOculto(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse") return true;
    if (parseFloat(s.opacity) === 0) return true;
    if (parseFloat(s.fontSize) < 3) return true;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return true;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return true;
    // Empujado fuera de la pantalla (el clásico left:-9999px).
    if (r.right < 0 || r.bottom < 0) return true;
    // Escrito del color exacto del fondo.
    if (s.color && s.color === s.backgroundColor) return true;
    return false;
  }

  function scanPromptInjection() {
    if (seen.has("promptinject")) return;
    const sospechosos = [];
    const anotar = (texto, via) => {
      if (sospechosos.length) return;
      const t2 = String(texto || "").replace(/\s+/g, " ").trim();
      if (t2.length < 40) return; // una instrucción es una frase, no dos palabras
      if (PROMPT_PATTERNS.some((re) => re.test(t2))) sospechosos.push({ t: t2, via });
    };

    // 1) Comentarios HTML: invisibles por definición.
    const it = document.createNodeIterator(document.documentElement, NodeFilter.SHOW_COMMENT);
    let c, vistos = 0;
    while ((c = it.nextNode()) && vistos++ < 400 && !sospechosos.length) {
      anotar(c.nodeValue, "comentario");
    }

    // 2) Datos estructurados: los lee la máquina, no la persona.
    if (!sospechosos.length) {
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => anotar(s.textContent, "json-ld"));
    }

    // 3) Texto oculto en el propio DOM. Se filtra primero por longitud, que es
    // barato, y solo entonces se consultan estilos y geometría.
    if (!sospechosos.length) {
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.nodeValue && n.nodeValue.trim().length >= 40 && !SKIP_HIDDEN.has(n.parentElement?.tagName)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
      });
      let n, mirados = 0;
      while ((n = walker.nextNode()) && mirados++ < 1500 && !sospechosos.length) {
        if (!PROMPT_PATTERNS.some((re) => re.test(n.nodeValue))) continue;
        if (estaOculto(n.parentElement)) anotar(n.nodeValue, "texto oculto");
      }
    }

    if (!sospechosos.length) return;
    // Se incluye un trozo de lo escondido: ver la orden es lo que enseña de
    // verdad qué ha intentado la página. Los textos se escapan al pintarlos.
    const muestra = sospechosos[0].t.slice(0, 80) + (sospechosos[0].t.length > 80 ? "…" : "");
    add({
      id: "promptinject",
      weight: 40,
      category: "scam",
      title: t("fPromptInjectTitle"),
      detail: t("fPromptInjectDetail", [muestra]),
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
  function scanScam(pageText) {
    if (seen.has("scam-text")) return;
    const text = pageText();
    if (SCAM_PATTERNS.some((re) => re.test(text))) {
      add({
        id: "scam-text",
        weight: 45,
        category: "scam",
        title: t("fScamTitle"),
        detail: t("fScamDetail"),
      });
    }
  }

  // --- 3b) ClickFix: la "verificación humana" que te hace ejecutar un comando
  // Dos ingredientes que juntos no tienen explicación honesta: instrucciones
  // para abrir el diálogo Ejecutar (o el Terminal) y el marco de una
  // verificación anti-robot. Por separado valen poco —un tutorial legítimo
  // menciona Win+R, y un artículo sobre esta misma estafa menciona las dos
  // cosas—, así que el peso se queda deliberadamente por debajo del umbral de
  // aviso: son las señales del portapapeles (page-probe) las que lo rematan.
  const RUN_KEYS = [
    /\b(win(dows)?|⊞)\s*\+\s*r\b/i,
    /\bctrl\s*\+\s*v\b/i,
    /⌘\s*\+\s*(espacio|space)/i,
    /\btecla (de )?windows\b.{0,25}\+\s*r\b/i,
  ];
  const HUMAN_CHECK = [
    /verific(a|ar|ación|ando)[^.]{0,40}(human|robot|persona)/i,
    /(no soy|not a)( un)? robot/i,
    /verify (that )?you('| a)?re (a )?human/i,
    /human verification|verificación humana/i,
    /captcha/i,
  ];
  function scanClickFix(pageText) {
    if (seen.has("clickfix:lure")) return;
    const text = pageText();
    if (RUN_KEYS.some((re) => re.test(text)) && HUMAN_CHECK.some((re) => re.test(text))) {
      add({
        id: "clickfix:lure",
        weight: 45,
        category: "scam",
        title: t("fClickfixLureTitle"),
        detail: t("fClickfixLureDetail"),
      });
    }
  }

  // --- 4) Iframes invisibles (posible clickjacking) --------------------------
  function scanIframes() {
    if (seen.has("hidden-iframes")) return;
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
        title: t("fIframesTitle"),
        detail: t("fIframesDetail", [String(hidden)]),
      });
    }
  }

  // El texto visible de la página. innerText obliga al navegador a recalcular
  // el layout, así que se lee una sola vez por pasada y lo comparten los cuatro
  // escaneos que lo necesitan (antes cada uno lo pedía por su cuenta).
  const readPageText = () => (document.body?.innerText || "").slice(0, 20000);

  const SCANS = [
    scanForms, scanBrandForm, scanFakeWindow, scanSeedPhrase, scanSvgScript,
    scanNotifBait, scanPromptInjection, scanScam, scanClickFix, scanIframes,
  ];
  function runScans() {
    if (!alive()) return;
    let text = null;
    const pageText = () => (text === null ? (text = readPageText()) : text);
    for (const scan of SCANS) {
      try {
        scan(pageText);
      } catch {
        /* un detector que falla en una página rara no se lleva a los demás */
      }
    }
  }

  // --- Banner de aviso (Shadow DOM para aislar estilos) -----------------------
  // El banner vive en el DOM de la página, que es justo quien NO debe poder
  // tocarlo. Por eso:
  //   - el shadow root es "closed": el JS de la página no llega a sus botones;
  //   - los botones solo atienden clics reales (isTrusted), no el .click() de
  //     un script;
  //   - no se busca por id: una página que crease antes un elemento con ese id
  //     impediría que se pintara;
  //   - si alguien lo arranca del DOM sin pulsar Cerrar, se vuelve a poner.
  // Aun así, una página siempre puede taparlo con algo encima: el icono de la
  // barra y la notificación del sistema quedan fuera de su alcance.
  //
  // El banner no es de un solo uso: el background reenvía el veredicto con cada
  // señal nueva y aquí se repinta. Si el usuario lo cerró en naranja y el riesgo
  // sube a rojo, vuelve a salir; cerrarlo en rojo lo calla del todo.
  const RANK = { safe: 0, warning: 1, danger: 2 };
  let banner = null; // { wrap, shadow, keeper }
  let bannerSig = "";
  let bannerOpen = false;
  let closedRank = 0;

  function renderBanner(verdict) {
    if (!verdict || !Array.isArray(verdict.reasons)) return;
    const rank = RANK[verdict.level] || 0;
    if (!rank || rank <= closedRank) return;
    const sig = `${verdict.level}|${verdict.score}|${verdict.reasons.map((r) => r.id).join(",")}`;
    if (banner && sig === bannerSig) return;
    bannerSig = sig;
    if (!banner) banner = mountBanner();
    paintBanner(verdict, rank);
  }

  function mountBanner() {
    // Un div y no un elemento propio: si la página registrase antes ese nombre
    // con customElements, podría secuestrar el elemento al insertarlo.
    const wrap = document.createElement("div");
    wrap.style.cssText = "all: initial !important; display: block !important;";
    const shadow = wrap.attachShadow({ mode: "closed" });
    // Reinsertar si la página lo quita (con un tope, por si se empeña en bucle).
    let reinserts = 0;
    const keeper = new MutationObserver(() => {
      if (!wrap.isConnected && reinserts++ < 5) document.documentElement.appendChild(wrap);
    });
    keeper.observe(document.documentElement, { childList: true });
    document.documentElement.appendChild(wrap);
    return { wrap, shadow, keeper };
  }

  function closeBanner(rank) {
    closedRank = Math.max(closedRank, rank);
    if (!banner) return;
    banner.keeper.disconnect();
    banner.wrap.remove();
    banner = null;
  }

  function paintBanner(verdict, rank) {
    const { shadow } = banner;
    const danger = verdict.level === "danger";
    const top = verdict.reasons[0];
    // Consejo según el tipo de amenaza principal: qué hacer, no solo qué pasa.
    const advKey = top && top.group ? `adv_${top.group}` : "";
    const advice = advKey && t(advKey) !== advKey ? t(advKey) : "";

    // Estilos cerrados en el shadow root: ni heredan ni dejan heredar nada de
    // la página. Colores sólidos (blanco sobre rojo/ámbar oscuro) que cumplen
    // contraste AA sobre cualquier web.
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
          font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff;
          background: ${danger ? "#a8201a" : "#8f4a07"};
          border-bottom: 3px solid ${danger ? "#ff8a7d" : "#f6b25e"};
          box-shadow: 0 6px 24px rgb(0 0 0 / .28); }
        .head { display: flex; align-items: center; gap: 14px; max-width: 1120px;
          margin: 0 auto; padding: 12px 16px; }
        svg { width: 26px; height: 26px; flex: none; fill: #fff; }
        .txt { flex: 1; min-width: 0; }
        .txt b { display: block; font-size: 15px; font-weight: 650; }
        .txt span { opacity: .92; }
        .txt .adv { display: block; margin-top: 3px; opacity: 1; font-weight: 600; }
        .btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        button { font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
          color: #fff; background: transparent; border: 1px solid rgb(255 255 255 / .55);
          border-radius: 8px; padding: 8px 12px; cursor: pointer; }
        button:hover { background: rgb(255 255 255 / .16); }
        button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        button.close { background: #fff; color: ${danger ? "#a8201a" : "#8f4a07"}; border-color: #fff; }
        button.close:hover { background: rgb(255 255 255 / .9); }
        ul { display: none; list-style: none; max-width: 1120px; margin: 0 auto;
          padding: 0 16px 14px 56px; max-height: 50vh; overflow: auto; }
        .bar.open ul { display: block; }
        li { padding: 8px 0; border-top: 1px solid rgb(255 255 255 / .22); }
        li b { font-weight: 650; }
        li p { margin: 2px 0 0; opacity: .92; }
        li a { color: #fff; font-weight: 600; }
        @media (max-width: 640px) {
          .head { flex-wrap: wrap; }
          .btns { width: 100%; justify-content: flex-start; }
          ul { padding-left: 16px; }
        }
      </style>
      <div class="bar${bannerOpen ? " open" : ""}" role="alert">
        <div class="head">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4 5.6v6.1c0 4.9 3.4 8.7 8 9.8 4.6-1.1 8-4.9 8-9.8V5.6L12 2.5Zm-1 5h2v6h-2v-6Zm0 8h2v2h-2v-2Z" /></svg>
          <div class="txt">
            <b>${escapeHtml(danger ? t("bDangerTitle") : t("bWarnTitle"))}</b>
            <span>${top ? escapeHtml(top.title) : escapeHtml(t("fDefaultReason"))} ${escapeHtml(t("bRisk", [String(verdict.score)]))}</span>
            ${advice ? `<span class="adv">${escapeHtml(advice)}</span>` : ""}
          </div>
          <div class="btns">
            <button class="details" aria-expanded="${bannerOpen}">${escapeHtml(t("bDetails"))}</button>
            <button class="trust" title="${escapeHtml(t("bTrustTip"))}">${escapeHtml(t("bTrust"))}</button>
            <button class="close">${escapeHtml(t("bClose"))}</button>
          </div>
        </div>
        <ul>${verdict.reasons
          .map(
            (r) =>
              `<li><b>${escapeHtml(r.title)}</b><p>${escapeHtml(r.detail)}${
                r.learn
                  ? ` <a href="${escapeHtml(r.learn)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("bLearn"))}</a>`
                  : ""
              }</p></li>`
          )
          .join("")}</ul>
      </div>`;

    const bar = shadow.querySelector(".bar");
    const onRealClick = (sel, fn) =>
      shadow.querySelector(sel).addEventListener("click", (e) => {
        if (e.isTrusted) fn();
      });
    onRealClick(".details", () => {
      bannerOpen = bar.classList.toggle("open");
      shadow.querySelector(".details").setAttribute("aria-expanded", String(bannerOpen));
    });
    onRealClick(".close", () => closeBanner(rank));
    onRealClick(".trust", () => {
      chrome.runtime
        .sendMessage({ type: "trust-host", host: location.hostname })
        .catch(() => {})
        .finally(() => closeBanner(RANK.danger));
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
})();
