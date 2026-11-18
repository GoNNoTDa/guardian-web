// Dominios que suplantan a una marca: homógrafos, typosquatting, la marca
// metida como subdominio y el nombre de la marca combinado con un gancho.
//
// Todo esto se decide con el NOMBRE del dominio, sin mirar la página, así que
// vive aquí —módulo puro, sin chrome.*— y lo usa el service worker en cuanto
// la navegación se confirma (antes de que exista el DOM) y también el
// guardián de resultados de búsqueda. Al ser puro, se prueba con node:test.
//
// Hasta la v0.7 esta lógica estaba en content.js y comparaba el host ENTERO
// con el dominio de la marca: "login.paypall.com" no saltaba (el subdominio
// alargaba la distancia) y "bbva.es.verificar-cuenta.top" tampoco.

import { registrable, isRawIp } from "./domain.js";
import { isSuspiciousTld } from "./blocklists.js";

// Marcas muy atacadas. `global: true` = la empresa opera de verdad bajo muchos
// TLD (amazon.de, google.fr, ebay.co.uk): en ellas "la marca con otra
// terminación" no dice nada salvo que la terminación sea de las raras.
const G = true;
const BRAND_LIST = [
  // Globales
  ["google.com", G], ["youtube.com", G], ["facebook.com", G], ["instagram.com", G],
  ["whatsapp.com", G], ["microsoft.com", G], ["outlook.com", G], ["office.com", G],
  ["apple.com", G], ["icloud.com", G], ["amazon.com", G], ["amazon.es", G],
  ["paypal.com", G], ["netflix.com", G], ["ebay.com", G], ["booking.com", G],
  ["linkedin.com", G], ["telegram.org", G], ["binance.com", G], ["coinbase.com", G],
  ["github.com", G], ["dropbox.com", G],
  // Banca España
  ["bbva.es"], ["santander.com", G], ["bancosantander.es"], ["caixabank.es"],
  ["bancsabadell.com"], ["bankinter.com"], ["unicajabanco.es"], ["abanca.com"],
  ["ing.es", G], ["openbank.es"], ["evobanco.com"], ["kutxabank.es"], ["ibercaja.es"],
  ["cajamar.es"], ["bizum.es"], ["ruralvia.com"],
  // Administración España
  ["agenciatributaria.gob.es"], ["seg-social.es"], ["sepe.es"], ["dgt.es"],
  ["correos.es"], ["clave.gob.es"],
  // Telecos / energía / comercio
  ["movistar.es"], ["vodafone.es", G], ["orange.es", G], ["iberdrola.es"], ["endesa.com"],
  ["elcorteingles.es"], ["wallapop.com"], ["vinted.es", G], ["renfe.com"],
];

// Nombre de la marca: primera etiqueta de su dominio registrable.
const nameOf = (domain) => registrable(domain).split(".")[0];

export const BRANDS = BRAND_LIST.map(([domain, global]) => ({
  domain,
  name: nameOf(domain),
  global: !!global,
}));

// Dominios legítimos que se parecen a alguna marca (ine.es está a distancia 1
// de ing.es) o que son de la propia marca con otro nombre.
const ALSO_LEGIT = [
  "ine.es", "boe.es", "abc.es", "as.com", "x.com", "ing.com", "orange.com",
  "correos.cl", "renfe.es", "finance.com", "minted.com", "bbva.com", "caixabank.com",
  "paypal.me", "youtu.be", "movistar.com", "iberdrola.com", "endesa.es",
  "google-analytics.com", "amazon-adsystem.com", "correosexpress.com",
  // De la propia marca, aunque el nombre parezca "marca + gancho".
  "microsoftonline.com", "office365.com", "amazonpay.com", "santanderbank.com",
  "orangebank.es", "appleid.com", "paypal-communication.com",
];

// Nombres que además son palabras corrientes, ciudades o siglas: solos no
// prueban nada ("orange-juice.com", "santander-turismo.es"); hace falta que
// vayan con un gancho de los de abajo.
const AMBIGUOUS = new Set([
  "orange", "apple", "santander", "correos", "office", "booking", "telegram",
  "outlook", "clave", "sepe", "dgt", "ing", "bizum", "amazon",
]);

// Palabras con las que los kits visten el dominio para que parezca oficial.
const HOOK =
  /^(log-?in|sign-?in|acces[os]+|secure|security|segur[oa]|seguridad|verif\w*|valid\w*|clientes?|clients?|cuentas?|accounts?|support|soporte|ayuda|help|update|actualiz\w*|auth\w*|banca|bank|banking|online|pagos?|pay|payments?|sms|alert[as]*|bloqueo|confirm\w*|wallet|recuper\w*|recovery|id|app|web|portal|sede|es|com|net|oficial|official|envios?|paquetes?|aduanas?|multas?|premios?|regalo|gift|bonus|particulares|empresas)$/;

// Caracteres visualmente idénticos o casi (cirílico/griego/leet) -> latino.
const CONFUSABLES = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
  "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "һ": "h", "ԛ": "q", "ԝ": "w",
  "ν": "v", "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k", "ρ": "p",
  "τ": "t", "υ": "u", "ℓ": "l", "ı": "i", "ɡ": "g", "ɑ": "a",
  "0": "o", "1": "l", "3": "e", "5": "s",
};

// TLD bajo los que es normal encontrar a una marca global: genéricos clásicos
// y cualquier código de país (dos letras) que no esté en la lista de abuso.
const COMMON_TLD = new Set(["com", "net", "org", "eu", "info", "app", "dev", "io"]);

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Decodificador punycode (RFC 3492) para etiquetas "xn--".
export function punyDecode(input) {
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
        if (index >= input.length) throw new Error("truncada");
        const c = input.charCodeAt(index++);
        const digit =
          c >= 48 && c <= 57 ? c - 22 : c >= 65 && c <= 90 ? c - 65 : c >= 97 && c <= 122 ? c - 97 : 36;
        if (digit >= 36) throw new Error("dígito inválido");
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

// Host tal como lo vería una persona: punycode decodificado y caracteres
// confundibles llevados a su letra latina.
export function skeleton(host) {
  const uni = host
    .split(".")
    .map((l) => (l.startsWith("xn--") ? punyDecode(l.slice(4)) : l))
    .join(".");
  return [...uni].map((c) => CONFUSABLES[c] || c).join("");
}

const isUnder = (host, domain) => host === domain || host.endsWith("." + domain);

// El nombre registrable lleva el de la marca más otra cosa. Devuelve el resto
// (lo que no es la marca) partido en trozos, o null si la marca no está.
function comboRest(name, brand) {
  if (name === brand) return null;
  if (name.startsWith(brand + "-")) return name.slice(brand.length + 1).split("-");
  if (name.endsWith("-" + brand)) return name.slice(0, -brand.length - 1).split("-");
  const mid = name.indexOf("-" + brand + "-");
  if (mid >= 0) return (name.slice(0, mid) + name.slice(mid + brand.length + 1)).split("-").filter(Boolean);
  // Pegado, sin guion ("paypallogin"): solo marcas de 5+ letras, y el resto
  // tiene que ser un gancho entero, para no partir palabras normales.
  if (brand.length >= 5) {
    if (name.startsWith(brand)) return [name.slice(brand.length)];
    if (name.endsWith(brand)) return [name.slice(0, -brand.length)];
  }
  return null;
}

// Analiza un host. Devuelve null o { kind, brand, weight, host, reg }:
//   homograph  80  tras deshacer punycode/confundibles ES el dominio de la marca
//   brandsub   60  el dominio de la marca aparece entero como subdominio de otro
//   typo       60  a una o dos letras del dominio de la marca
//   combo   30-45  nombre de la marca + gancho ("paypal-login", "bbva-clientes")
//   othertld   30  el nombre de la marca bajo otra terminación
// `brand` es el dominio legítimo con el que se confunde.
export function analyzeHost(rawHost) {
  const host = String(rawHost || "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host || !host.includes(".") || isRawIp(host)) return null;

  for (const b of BRANDS) if (isUnder(host, b.domain)) return null;
  for (const d of ALSO_LEGIT) if (isUnder(host, d)) return null;

  const reg = registrable(host);
  const name = reg.split(".")[0];
  const tld = reg.slice(name.length + 1);
  const found = (kind, brand, weight) => ({ kind, brand, weight, host, reg });

  // 1) Homógrafo: lo que se LEE es el dominio de la marca.
  const skel = skeleton(host);
  if (skel !== host) {
    for (const b of BRANDS) if (isUnder(skel, b.domain)) return found("homograph", b.domain, 80);
  }

  // 2) La marca como subdominio: "bbva.es.verificar-cuenta.top". En un móvil
  //    la barra enseña el principio de la dirección, que es justo el señuelo.
  //    Se mira sobre lo que se LEE, para que "g00gle.com.acceso.top" también caiga.
  const skelReg = registrable(skel);
  if (skel !== skelReg) {
    const dotted = "." + skel.slice(0, -skelReg.length);
    for (const b of BRANDS) {
      if (dotted.includes("." + b.domain + ".")) return found("brandsub", b.domain, 60);
    }
  }

  let weak = null; // candidato flojo; se devuelve solo si no sale nada mejor
  for (const b of BRANDS) {
    // 3) Typosquatting sobre el dominio registrable (ya sin subdominios).
    if (b.domain.length >= 6 && b.name !== name) {
      const maxDist = b.domain.length >= 10 ? 2 : 1;
      const breg = registrable(b.domain);
      if (Math.abs(reg.length - breg.length) <= maxDist) {
        const dist = levenshtein(reg, breg);
        if (dist > 0 && dist <= maxDist) return found("typo", b.domain, 60);
      }
    }

    // 4) Marca + gancho en el nombre registrable.
    const rest = b.name.length >= 3 ? comboRest(name, b.name) : null;
    if (rest && rest.length && rest.every(Boolean)) {
      const glued = !name.includes("-");
      const hooked = rest.some((w) => HOOK.test(w));
      // Pegado pesa menos: "marcaonline" lo usan también las propias marcas.
      if (hooked && !glued) return found("combo", b.domain, 45);
      if (hooked && rest.every((w) => HOOK.test(w)) && !weak) weak = found("combo", b.domain, 35);
      if (!glued && !AMBIGUOUS.has(b.name) && !weak) weak = found("combo", b.domain, 30);
    }

    // 5) El mismo nombre con otra terminación. Señal más débil: a veces es la
    //    propia empresa. En marcas globales solo cuenta bajo un TLD raro.
    if (name === b.name && b.domain.length >= 6 && !weak) {
      const odd = isSuspiciousTld(reg) || !(COMMON_TLD.has(tld) || /^([a-z]{2}|[a-z]{2,3}\.[a-z]{2})$/.test(tld));
      if (!b.global || odd) weak = found("othertld", b.domain, 30);
    }
  }
  return weak;
}
