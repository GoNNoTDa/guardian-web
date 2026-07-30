// Page probe (mundo MAIN): observa comportamientos que el background NO puede
// ver desde fuera, envolviendo APIs de la propia página. Solo OBSERVA; nunca
// altera el resultado de las funciones originales. Comunica hallazgos al
// content script mediante window.postMessage.

(() => {
  // Búfer: este script corre en document_start, pero el content script que
  // escucha no existe hasta document_idle. Todo hallazgo se guarda y se
  // reemite cuando el content script pide un "flush" al arrancar.
  const buffered = [];
  const post = (finding) => {
    buffered.push(finding);
    window.postMessage({ __guardian: true, finding }, "*");
  };
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__guardian_flush !== true) return;
    for (const f of buffered) window.postMessage({ __guardian: true, finding: f }, "*");
  });

  const start = performance.now();
  const early = () => performance.now() - start < 4000; // "nada más entrar"

  // --- Exfiltración de datos de formularios (A2) --------------------------
  // El content script (mundo aislado) nos manda los valores sensibles que el
  // usuario teclea (email, DNI, tarjeta, contraseña...). Aquí envolvemos las
  // salidas de datos (fetch / XHR / sendBeacon) y avisamos si alguno de esos
  // valores viaja hacia un dominio DISTINTO al de la página.
  //
  // Privacidad: los valores solo viven en memoria de esta página y se usan
  // para una comparación local; nunca se almacenan ni se envían a ningún sitio.
  // Los envoltorios de red se ARMAN solo cuando hay algo que vigilar (el
  // usuario ha tecleado datos sensibles) y se DESARMAN al disparar la señal.
  // Así no estamos en la pila de llamadas del tráfico normal y los errores de
  // la propia página (p. ej. violaciones de su CSP por píxeles de tracking)
  // no se atribuyen a la extensión en chrome://extensions.
  const watched = new Set();
  const watchedCards = new Set(); // subconjunto: números de tarjeta (skimmer)
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__guardian_watch !== true) return;
    watched.clear();
    watchedCards.clear();
    for (const v of e.data.values || []) if (typeof v === "string" && v.length >= 5) watched.add(v);
    for (const v of e.data.cards || []) if (typeof v === "string" && v.length >= 5) watchedCards.add(v);
    if (watched.size) armExfil();
  });

  const pageHost = location.hostname.replace(/^www\./, "");
  function isThirdParty(rawUrl) {
    try {
      const h = new URL(rawUrl, location.href).hostname.replace(/^www\./, "");
      return h && h !== pageHost && !h.endsWith("." + pageHost) && !pageHost.endsWith("." + h);
    } catch {
      return false;
    }
  }
  function bodyToString(body) {
    try {
      if (body == null) return "";
      if (typeof body === "string") return body;
      if (body instanceof URLSearchParams) return body.toString();
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        return [...body.entries()].map(([k, v]) => `${k}=${v}`).join("&");
      }
      return "";
    } catch {
      return "";
    }
  }
  let exfilFlagged = false;
  function checkExfil(rawUrl, ...payloads) {
    if (exfilFlagged || !watched.size || !isThirdParty(rawUrl)) return;
    const haystack = (rawUrl + " " + payloads.map(bodyToString).join(" ")).toLowerCase();
    for (const v of watched) {
      if (haystack.includes(v.toLowerCase())) {
        exfilFlagged = true;
        let host = rawUrl;
        try {
          host = new URL(rawUrl, location.href).hostname;
        } catch {
          /* deja la url */
        }
        // Si el dato filtrado es un número de tarjeta, es un skimmer (Magecart):
        // más grave que una exfiltración genérica.
        const isCard = watchedCards.has(v);
        post(
          isCard
            ? {
                id: `skimmer:${host}`,
                weight: 90,
                category: "malware",
                titleKey: "fSkimmerTitle",
                detailKey: "fSkimmerDetail",
                params: [host],
              }
            : {
                id: `exfil:${host}`,
                weight: 70,
                category: "privacy",
                titleKey: "fExfilTitle",
                detailKey: "fExfilDetail",
                params: [host],
              }
        );
        disarmExfil(); // señal disparada: fuera de la pila de llamadas
        return;
      }
    }
  }

  let exfilArmed = false;
  let restoreExfil = [];
  function disarmExfil() {
    restoreExfil.forEach((r) => r());
    restoreExfil = [];
  }
  function armExfil() {
    if (exfilArmed) return;
    exfilArmed = true;

    if (window.fetch) {
      const orig = window.fetch;
      window.fetch = function (input, init) {
        try {
          const url = typeof input === "string" ? input : input && input.url;
          checkExfil(url || "", init && init.body);
        } catch {
          /* no romper */
        }
        return orig.apply(this, arguments);
      };
      restoreExfil.push(() => {
        window.fetch = orig;
      });
    }
    if (window.XMLHttpRequest) {
      const proto = XMLHttpRequest.prototype;
      const open = proto.open;
      const send = proto.send;
      proto.open = function (method, url) {
        this.__guardianUrl = url;
        return open.apply(this, arguments);
      };
      proto.send = function (body) {
        try {
          checkExfil(this.__guardianUrl || "", body);
        } catch {
          /* no romper */
        }
        return send.apply(this, arguments);
      };
      restoreExfil.push(() => {
        proto.open = open;
        proto.send = send;
      });
    }
    if (navigator.sendBeacon) {
      const orig = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        try {
          checkExfil(url || "", data);
        } catch {
          /* no romper */
        }
        return orig(url, data);
      };
      restoreExfil.push(() => {
        navigator.sendBeacon = orig;
      });
    }
  }

  // --- Fingerprinting de canvas -------------------------------------------
  // Espía de un solo uso: en cuanto la señal dispara, se restauran las
  // funciones originales. Así dejamos de estar en la pila de llamadas y las
  // advertencias de rendimiento de Canvas2D del navegador no se atribuyen a
  // la extensión en chrome://extensions.
  let canvasReads = 0;
  let canvasFlagged = false;
  let restoreCanvas = [];
  const flagCanvas = () => {
    if (!canvasFlagged && ++canvasReads >= 3) {
      canvasFlagged = true;
      // Sin chrome.i18n en el mundo MAIN: se envían claves y el content
      // script las traduce al idioma del navegador.
      post({
        id: "fp-canvas",
        weight: 20,
        category: "privacy",
        titleKey: "fCanvasTitle",
        detailKey: "fCanvasDetail",
      });
      restoreCanvas.forEach((r) => r());
      restoreCanvas = [];
    }
  };
  restoreCanvas.push(wrap(HTMLCanvasElement.prototype, "toDataURL", flagCanvas));
  if (window.CanvasRenderingContext2D) {
    restoreCanvas.push(wrap(CanvasRenderingContext2D.prototype, "getImageData", flagCanvas));
  }

  // --- Cryptojacking: WebAssembly + muchos Workers ------------------------
  let wasm = 0;
  let workers = 0;
  let mineFlagged = false;
  let restoreMining = [];
  const mineCheck = () => {
    if (!mineFlagged && wasm >= 1 && workers >= 4) {
      mineFlagged = true;
      post({
        id: "fp-mining",
        weight: 40,
        category: "malware",
        titleKey: "fWasmTitle",
        detailKey: "fWasmDetail",
      });
      restoreMining.forEach((r) => r());
      restoreMining = [];
    }
  };
  if (window.WebAssembly) {
    restoreMining.push(wrap(WebAssembly, "instantiate", () => { wasm++; mineCheck(); }));
    if (WebAssembly.instantiateStreaming) {
      restoreMining.push(wrap(WebAssembly, "instantiateStreaming", () => { wasm++; mineCheck(); }));
    }
  }
  const NativeWorker = window.Worker;
  if (NativeWorker) {
    window.Worker = function (...args) {
      workers++;
      mineCheck();
      return new NativeWorker(...args);
    };
    window.Worker.prototype = NativeWorker.prototype;
    restoreMining.push(() => { window.Worker = NativeWorker; });
  }

  // --- Permisos intrusivos solicitados al cargar --------------------------
  if (window.Notification && Notification.requestPermission) {
    const orig = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = function (...a) {
      if (early()) {
        post({
          id: "perm-notif",
          weight: 15,
          category: "scam",
          titleKey: "fPermNotifTitle",
          detailKey: "fPermNotifDetail",
        });
      }
      return orig(...a);
    };
  }
  if (navigator.geolocation) {
    const orig = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = function (...a) {
      if (early()) {
        post({
          id: "perm-geo",
          weight: 20,
          category: "privacy",
          titleKey: "fPermGeoTitle",
          detailKey: "fPermGeoDetail",
        });
      }
      return orig(...a);
    };
  }

  // --- Browser locker / tácticas de secuestro -----------------------------
  // Inundación del historial (history flooding): las páginas de "tu PC está
  // infectado" llaman a pushState en bucle para romper el botón Atrás y
  // atrapar al usuario. Espía de un solo uso.
  let pushCount = 0;
  let lockerFlagged = false;
  let restoreLocker = [];
  const restoreHistory = wrap(history, "pushState", () => {
    if (lockerFlagged) return;
    pushCount++;
    if (pushCount >= 10 && performance.now() - start < 5000) {
      lockerFlagged = true;
      post({
        id: "locker:history",
        weight: 45,
        category: "scam",
        titleKey: "fLockerHistoryTitle",
        detailKey: "fLockerHistoryDetail",
      });
      restoreLocker.forEach((r) => r());
    }
  });
  restoreLocker.push(restoreHistory);

  // Pantalla completa forzada nada más entrar (sin gesto real del usuario):
  // típico de los lockers para ocultar la barra de direcciones.
  if (window.Element && Element.prototype.requestFullscreen) {
    const restoreFs = wrap(Element.prototype, "requestFullscreen", () => {
      if (early()) {
        post({
          id: "locker:fullscreen",
          weight: 25,
          category: "scam",
          titleKey: "fLockerFsTitle",
          detailKey: "fLockerFsDetail",
        });
      }
    });
    restoreLocker.push(restoreFs);
  }

  // --- ClickFix / CAPTCHA falso: comandos colados en el portapapeles -------
  // La estafa dominante de 2025-2026: una "verificación humana" que no
  // funciona pide pulsar Win+R y Ctrl+V, y la página ha dejado ya en el
  // portapapeles una línea de PowerShell que descarga un infostealer.
  //
  // Aquí solo se mira QUÉ escribe la web en el portapapeles y se emite una
  // señal booleana: el contenido no se guarda, no se copia a ningún sitio y no
  // viaja en el hallazgo. Tampoco se altera lo que la página copia.
  //
  // Los kits rellenan el comando con cientos de espacios para que en el
  // diálogo Ejecutar solo se vea un texto inocuo ("verification-id-9F2A") y el
  // comando real quede fuera de la vista, a la derecha. Ese relleno no tiene
  // ningún uso legítimo, así que pesa más que el comando por sí solo.
  const CMD_PATTERNS = [
    /\b(powershell|pwsh)(\.exe)?\b/i,
    /\b(mshta|certutil|bitsadmin|rundll32|regsvr32|wscript|cscript|msiexec|schtasks|forfiles)(\.exe)?\b/i,
    /\bcmd(\.exe)?\s*\/[ck]\b/i,
    /\b(iex|invoke-expression|invoke-webrequest|downloadstring|frombase64string)\b/i,
    /\s-(enc|encodedcommand|nop|noprofile|windowstyle)\b/i,
    /\b(curl|wget)\b[^|]{0,200}\|\s*(ba)?sh\b/i,
    /\bosascript\s+-e\b/i,
  ];
  const CMD_PADDING = /[ \t ]{40,}/;
  let clipFlagged = false;
  function inspectClipboard(text) {
    if (clipFlagged || typeof text !== "string" || text.length < 12) return;
    if (!CMD_PATTERNS.some((re) => re.test(text))) return;
    clipFlagged = true;
    // Relleno + comando: inequívoco, se está ocultando lo que se ejecutará.
    post(
      CMD_PADDING.test(text)
        ? {
            id: "clickfix:pad",
            weight: 60,
            category: "scam",
            titleKey: "fClickfixPadTitle",
            detailKey: "fClickfixPadDetail",
          }
        : {
            id: "clickfix:cmd",
            weight: 45,
            category: "scam",
            titleKey: "fClickfixCmdTitle",
            detailKey: "fClickfixCmdDetail",
          }
    );
  }

  // --- Secuestro del portapapeles ------------------------------------------
  // Copias un IBAN o una dirección de criptomoneda y la web te la cambia por
  // la del estafador: cuando pegas, el dinero va a otra cuenta. Se compara lo
  // que el usuario tenía seleccionado con lo que el sitio escribe.
  //
  // Solo se actúa DENTRO de un evento copy/cut real (de ahí el flag): un botón
  // "copiar código" pulsado mientras hay texto seleccionado en otra parte de la
  // página escribe algo distinto de la selección sin que eso sea un ataque.
  //
  // Igual que arriba, nada de esto se almacena ni se envía: la comparación es
  // en memoria y del hallazgo solo sale el tipo de dato afectado.
  const ACCOUNT_PATTERNS = [
    /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/, // IBAN
    /\b0x[a-fA-F0-9]{40}\b/, // Ethereum y compatibles
    /\bbc1[a-z0-9]{25,62}\b/, // Bitcoin bech32
    /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/, // Bitcoin legacy
    /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/, // Monero
  ];
  const squash = (s) => String(s).replace(/\s+/g, " ").trim();
  let inCopyEvent = false;
  let copySelection = "";
  const markCopy = () => {
    inCopyEvent = true;
    copySelection = squash(window.getSelection() || "");
    // El flag vive solo mientras se despacha el evento.
    setTimeout(() => {
      inCopyEvent = false;
    }, 0);
  };
  document.addEventListener("copy", markCopy, true);
  document.addEventListener("cut", markCopy, true);

  // Un flag por tipo de señal, no uno solo: si fuera único, una web podría
  // gastarlo con una sustitución inocua y hacer después el cambiazo de cuenta
  // sin que se avisara con el peso que le corresponde.
  let swapFlagged = false;
  let swapAccountFlagged = false;
  function checkClipboardSwap(written) {
    if (!inCopyEvent || typeof written !== "string") return;
    const before = copySelection;
    const after = squash(written);
    if (!before || !after || before.length < 12 || before === after) return;
    // Adorno, no sustitución: muchos sitios añaden la fuente o un formato
    // (copiar un enlace como Markdown, añadir "leído en …"). Si el texto
    // original sigue dentro de lo copiado, no te han cambiado nada.
    if (after.includes(before) || before.includes(after)) return;

    // Si en el cambiazo entra un IBAN o una dirección de criptomoneda, el
    // objetivo es desviar un pago: eso ya no es una molestia, es fraude.
    const account = ACCOUNT_PATTERNS.some(
      (re) => re.test(before.replace(/\s/g, "")) || re.test(after.replace(/\s/g, ""))
    );
    if (account) {
      if (swapAccountFlagged) return;
      swapAccountFlagged = true;
      post({
        id: "clipswap:account",
        weight: 70,
        category: "scam",
        titleKey: "fClipSwapAccountTitle",
        detailKey: "fClipSwapAccountDetail",
      });
      return;
    }
    if (swapFlagged) return;
    swapFlagged = true;
    post({
      id: "clipswap",
      weight: 45,
      category: "scam",
      titleKey: "fClipSwapTitle",
      detailKey: "fClipSwapDetail",
    });
  }

  // Vía moderna: navigator.clipboard.writeText().
  if (window.Clipboard && Clipboard.prototype.writeText) {
    wrap(Clipboard.prototype, "writeText", (text) => {
      inspectClipboard(text);
      checkClipboardSwap(text);
    });
  }
  // Vía clásica: el sitio secuestra el evento "copy" y escribe su propio texto.
  if (window.DataTransfer) {
    wrap(DataTransfer.prototype, "setData", (format, data) => {
      if (!/text/i.test(String(format))) return;
      inspectClipboard(data);
      checkClipboardSwap(data);
    });
  }
  // Vía heredada: execCommand("copy") sobre una selección o un textarea oculto.
  wrap(document, "execCommand", (cmd) => {
    if (!/^(copy|cut)$/i.test(String(cmd))) return;
    const sel = String(window.getSelection() || "");
    if (sel) inspectClipboard(sel);
    const el = document.activeElement;
    if (el && typeof el.value === "string") inspectClipboard(el.value);
  });

  // Envuelve un método conservando su comportamiento; onCall es un espía.
  // Devuelve una función que RESTAURA el original (espías de un solo uso).
  function wrap(obj, name, onCall) {
    const original = obj[name];
    if (typeof original !== "function") return () => {};
    obj[name] = function (...args) {
      try {
        onCall.apply(this, args);
      } catch {
        /* nunca romper la página por el espía */
      }
      return original.apply(this, args);
    };
    return () => {
      obj[name] = original;
    };
  }
})();
