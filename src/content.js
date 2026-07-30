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

  const seen = new Set();
  function add(f) {
    if (!f || seen.has(f.id) || !alive()) return;
    seen.add(f.id);
    // Las señales del page-probe (mundo MAIN, sin chrome.i18n) llegan como
    // claves de mensaje; se traducen aquí antes de reenviarlas.
    if (f.titleKey) {
      f = {
        id: f.id,
        weight: f.weight,
        category: f.category,
        title: t(f.titleKey, f.params || []),
        detail: t(f.detailKey, f.params || []),
      };
    }
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

    // Reescaneo ante contenido dinámico (una pasada con retardo).
    let scheduled = false;
    const mo = new MutationObserver(() => {
      // Script huérfano (extensión recargada): desconectar y no hacer nada más.
      if (!alive()) {
        mo.disconnect();
        return;
      }
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        if (alive()) runScans();
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
            title: t("fHomoTitle"),
            detail: t("fHomoDetail", [rawHost, b]),
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
          title: t("fOtherTldTitle"),
          detail: t("fOtherTldDetail", [rawHost, b]),
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
          title: t("fTypoTitle"),
          detail: t("fTypoDetail", [rawHost, b]),
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

  function scanBrandForm() {
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
  function scanFakeWindow() {
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
  function scanSeedPhrase() {
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
    const rejilla = fields.length >= 12 && SEED_RE.test((document.body?.innerText || "").slice(0, 20000));

    if (!campoDirecto && !rejilla) return;
    add({
      id: "seedphrase",
      weight: 90,
      category: "phishing",
      title: t("fSeedTitle"),
      detail: t("fSeedDetail"),
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
  function scanClickFix() {
    const text = (document.body?.innerText || "").slice(0, 20000);
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

  function runScans() {
    checkDomain();
    scanForms();
    scanBrandForm();
    scanFakeWindow();
    scanSeedPhrase();
    scanScam();
    scanClickFix();
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
        li a { color: #fff; font-weight: 600; white-space: nowrap; }
        .head { display: flex; align-items: center; gap: 12px; }
        .body { width: 100%; }
      </style>
      <div class="bar">
        <div class="body">
          <div class="head">
            <span class="ico">${danger ? "🛑" : "⚠️"}</span>
            <span class="txt">
              <b>${escapeHtml(danger ? t("bDangerTitle") : t("bWarnTitle"))}</b><br>
              <small>${top ? escapeHtml(top.title) : escapeHtml(t("fDefaultReason"))} ${escapeHtml(t("bRisk", [String(verdict.score)]))}</small>
            </span>
            <button class="details">${escapeHtml(t("bDetails"))}</button>
            <button class="trust" title="${escapeHtml(t("bTrustTip"))}">${escapeHtml(t("bTrust"))}</button>
            <button class="close">${escapeHtml(t("bClose"))}</button>
          </div>
          <ul>${verdict.reasons
            .map(
              (r) =>
                `<li><b>${escapeHtml(r.title)}</b> — ${escapeHtml(r.detail)}${
                  r.learn
                    ? ` <a href="${escapeHtml(r.learn)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("bLearn"))}</a>`
                    : ""
                }</li>`
            )
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
