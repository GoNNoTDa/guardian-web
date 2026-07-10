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
  const watched = new Set();
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__guardian_watch !== true) return;
    watched.clear();
    for (const v of e.data.values || []) if (typeof v === "string" && v.length >= 5) watched.add(v);
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
        post({
          id: `exfil:${host}`,
          weight: 70,
          category: "privacy",
          title: "Posible exfiltración de datos del formulario",
          detail: `Datos que has escrito viajan hacia un dominio externo: ${host}.`,
        });
        return;
      }
    }
  }

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
      post({
        id: "fp-canvas",
        weight: 20,
        category: "privacy",
        title: "Fingerprinting de navegador",
        detail: "La web lee repetidamente el canvas para identificarte de forma encubierta.",
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
        title: "Posible minado de criptomonedas",
        detail: "Uso intensivo de WebAssembly y múltiples workers (patrón de cryptojacking).",
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
          title: "Pide notificaciones nada más entrar",
          detail: "Solicita permiso de notificaciones al instante: táctica habitual de spam/scam.",
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
          title: "Pide tu ubicación al entrar",
          detail: "Solicita geolocalización sin ninguna interacción previa del usuario.",
        });
      }
      return orig(...a);
    };
  }

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
