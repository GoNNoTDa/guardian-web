// Funciones puras de src/lib y src/settings.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { registrable, isRawIp, isLocalOrPrivate, weirdPort } from "../src/lib/domain.js";
import { analyzeDownload } from "../src/lib/downloads.js";
import { computeVerdict } from "../src/lib/scoring.js";
import { isTrusted, hostMatches } from "../src/lib/trusted.js";
import { isSuspiciousTld } from "../src/lib/blocklists.js";
import {
  DETECTORS, DEFAULTS, mergeDefaults, detectorOf, groupOf, GROUPS, exportBundle, sanitizeImport,
} from "../src/settings.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("registrable: dos etiquetas, o tres con sufijo de segundo nivel", () => {
  const cases = {
    "bbva.es": "bbva.es",
    "www.bbva.es": "bbva.es",
    "www.ing.es": "ing.es", // antes devolvía "www.ing.es" por tener "ing" 3 letras
    "app.dgt.es": "dgt.es",
    "sede.agenciatributaria.gob.es": "agenciatributaria.gob.es",
    "a.b.example.co.uk": "example.co.uk",
    "tienda.ejemplo.com.mx": "ejemplo.com.mx",
    "foo.github.io": "github.io",
    "bbva.es.verificar-cuenta.top": "verificar-cuenta.top",
    "WWW.Example.COM": "example.com",
    "localhost": "localhost",
    "10.0.0.1": "10.0.0.1",
  };
  for (const [host, want] of Object.entries(cases)) assert.equal(registrable(host), want, host);
});

test("content.js usa la misma regla de dominio registrable", () => {
  // Los content scripts no pueden importar módulos, así que sld() está copiada
  // allí. Se extrae del fuente y se compara con lib/domain.js.
  const src = read("src/content.js");
  const m = src.match(/const SECOND_LEVEL = new Set\(\[[\s\S]*?\]\);\s*function sld\(h\) \{[\s\S]*?\n  \}/);
  assert.ok(m, "no se encuentra sld() en content.js");
  const sld = new Function(`${m[0]}; return sld;`)();
  for (const h of ["bbva.es", "login.caixabank.es", "www.ing.es", "sede.agenciatributaria.gob.es", "a.b.example.co.uk", "x.verificar-cuenta.top"]) {
    assert.equal(sld(h), registrable(h).split(".")[0], h);
  }
});

test("IPs y puertos", () => {
  assert.ok(isRawIp("203.0.113.9"));
  assert.ok(isRawIp("[2001:db8::1]"));
  assert.ok(!isRawIp("example.com"));
  for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.10", "172.16.5.5", "169.254.1.1", "[::1]"]) {
    assert.ok(isLocalOrPrivate(h), h);
  }
  for (const h of ["8.8.8.8", "172.32.0.1", "example.com"]) assert.ok(!isLocalOrPrivate(h), h);
  assert.equal(weirdPort("https://example.com/"), null);
  assert.equal(weirdPort("https://example.com:443/"), null);
  assert.equal(weirdPort("http://example.com:8080/x"), "8080");
  assert.equal(weirdPort("no es una url"), null);
});

test("confianza y TLD de riesgo", () => {
  assert.ok(isTrusted("bbva.es"));
  assert.ok(isTrusted("www.bbva.es"));
  assert.ok(!isTrusted("bbva.es.evil.top"));
  assert.ok(!isTrusted("notbbva.es"));
  assert.ok(hostMatches("a.example.com", "example.com"));
  assert.ok(!hostMatches("badexample.com", "example.com"));
  assert.ok(isSuspiciousTld("premio.tk"));
  assert.ok(!isSuspiciousTld("example.com"));
});

test("descargas: ejecutables, doble extensión y orden invertido", () => {
  assert.equal(analyzeDownload("informe.pdf"), null);
  assert.equal(analyzeDownload("sin-extension"), null);
  assert.equal(analyzeDownload(""), null);
  assert.deepEqual(analyzeDownload("C:\\Users\\x\\Downloads\\Factura.PDF.exe"), {
    kind: "double", weight: 90, name: "factura.pdf.exe", ext: "exe", prev: "pdf",
  });
  assert.equal(analyzeDownload("setup.msi").kind, "exe");
  assert.equal(analyzeDownload("setup.msi").weight, 45);
  // Windows ignora puntos y espacios finales: sigue siendo un .exe.
  assert.equal(analyzeDownload("foto.jpg.exe. ").kind, "double");
  // U+202E: se lee "facturaexe.pdf", pero el fichero es un .exe.
  assert.equal(analyzeDownload("factura\u202Efdp.exe").kind, "bidi");
  assert.equal(analyzeDownload("factura\u202Efdp.exe").weight, 90);
});

test("descargas: en una URL solo cuenta la ruta", () => {
  assert.equal(analyzeDownload("https://example.com/descarga?file=x.exe"), null);
  assert.equal(analyzeDownload("https://example.com/files/setup.exe?v=2").kind, "exe");
  assert.equal(analyzeDownload("blob:https://example.com/3f2a"), null);
  assert.equal(analyzeDownload("https://example.com/%66oto.jpg.scr").kind, "double");
});

test("puntuación y umbrales", () => {
  const th = { warning: 50, danger: 100 };
  assert.deepEqual(computeVerdict([], th), { score: 0, level: "safe", reasons: [] });
  assert.equal(computeVerdict([{ weight: 49 }], th).level, "safe");
  assert.equal(computeVerdict([{ weight: 50 }], th).level, "warning");
  assert.equal(computeVerdict([{ weight: 60 }, { weight: 45 }], th).level, "danger");
  const v = computeVerdict([{ id: "a", weight: 20 }, { id: "b", weight: 70 }, { id: "c" }], th);
  assert.equal(v.score, 90);
  assert.deepEqual(v.reasons.map((r) => r.id), ["b", "a", "c"]);
});

test("ajustes: valores por defecto y mezcla", () => {
  assert.equal(DEFAULTS.detectors.domainage, false, "la edad de dominio va apagada: envía el dominio a un tercero");
  const s = mergeDefaults({ thresholds: { warning: 70 }, detectors: { scam: false } });
  assert.deepEqual(s.thresholds, { warning: 70, danger: 100 });
  assert.equal(s.detectors.scam, false);
  assert.equal(s.detectors.typosquat, true);
  assert.equal(mergeDefaults(null).localMode, false);
});

test("cada id de señal lleva a un detector que existe", () => {
  const keys = new Set(DETECTORS.map((d) => d.key));
  const src = read("src/settings.js");
  const map = src.slice(src.indexOf("const ID_TO_DETECTOR"), src.indexOf("export function detectorOf"));
  const targets = [...map.matchAll(/:\s*"([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.ok(targets.length > 30);
  for (const t of targets) assert.ok(keys.has(t), `detector desconocido: ${t}`);
  // Y cada detector tiene al menos un id que lo alimenta.
  for (const k of keys) assert.ok(targets.includes(k), `ningún id lleva a ${k}`);

  assert.equal(detectorOf("homograph:google.com"), "typosquat");
  assert.equal(detectorOf("brand-sub:bbva.es"), "typosquat");
  assert.equal(detectorOf("combo:paypal.com"), "typosquat");
  assert.equal(detectorOf("web3:permit"), "walletsign");
  assert.equal(detectorOf("algo-inventado"), "other");
  assert.equal(groupOf("typosquat"), "phishing");
  assert.equal(groupOf("other"), "net");
  assert.deepEqual([...GROUPS].sort(), ["ai", "downloads", "net", "phishing", "privacy", "scam", "web3"]);
});

test("las señales del probe llevan a un detector", () => {
  const src = read("src/content.js");
  const block = src.slice(src.indexOf("const PROBE_FINDINGS"), src.indexOf("function fromProbe"));
  const ids = [...block.matchAll(/^\s{4}"?([a-z0-9:-]+)"?: \{ weight/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 15, `solo ${ids.length} ids`);
  for (const id of ids) assert.notEqual(detectorOf(id), "other", id);
});

test("copia de ajustes: no lleva las claves de API", () => {
  const b = exportBundle({ apiKeys: { googleSafeBrowsing: "SECRETO" }, localMode: true }, ["ejemplo.com"], "0.8.0");
  assert.equal(b.app, "guardian-web");
  assert.equal(b.settings.localMode, true);
  assert.equal(b.settings.apiKeys, undefined);
  assert.ok(!JSON.stringify(b).includes("SECRETO"));
  assert.deepEqual(b.whitelist, ["ejemplo.com"]);
});

test("copia de ajustes: lo importado se valida campo a campo", () => {
  assert.equal(sanitizeImport(null), null);
  assert.equal(sanitizeImport("hola"), null);
  assert.equal(sanitizeImport({ settings: {} }), null, "sin la marca de la app no es una copia");

  const current = { apiKeys: { googleSafeBrowsing: "MI-CLAVE", urlhaus: "" } };
  const r = sanitizeImport(
    {
      app: "guardian-web",
      settings: {
        localMode: "sí", // no es booleano: se ignora
        notifications: false,
        communityUrl: "http://sin-cifrar.example", // http: se ignora
        thresholds: { warning: 5, danger: 2 },
        detectors: { scam: false, inventado: true, typosquat: "no" },
        apiKeys: { googleSafeBrowsing: "CLAVE-AJENA" },
        __proto__: { polluted: true },
      },
      whitelist: ["Ejemplo.com", "ejemplo.com", "no es un host", "<script>", 42, "a.b.example.org"],
    },
    current
  );
  assert.equal(r.settings.localMode, false);
  assert.equal(r.settings.notifications, false);
  assert.equal(r.settings.communityUrl, DEFAULTS.communityUrl);
  assert.deepEqual(r.settings.thresholds, { warning: 10, danger: 10 });
  assert.equal(r.settings.detectors.scam, false);
  assert.equal(r.settings.detectors.typosquat, true);
  assert.equal("inventado" in r.settings.detectors, false);
  assert.equal(r.settings.apiKeys.googleSafeBrowsing, "MI-CLAVE", "se conservan las claves propias");
  assert.deepEqual(r.whitelist, ["ejemplo.com", "a.b.example.org"]);
  assert.equal({}.polluted, undefined);

  assert.equal(sanitizeImport({ app: "guardian-web", settings: { communityUrl: "" } }).settings.communityUrl, "");
  assert.equal(
    sanitizeImport({ app: "guardian-web", settings: { communityUrl: "https://mi.servidor.example/gw/" } }).settings.communityUrl,
    "https://mi.servidor.example/gw"
  );
});

test("ida y vuelta: exportar e importar deja los ajustes igual", () => {
  const original = mergeDefaults({
    localMode: true, searchGuard: false, thresholds: { warning: 60, danger: 120 },
    detectors: { fingerprint: false, domainage: true },
  });
  const back = sanitizeImport(JSON.parse(JSON.stringify(exportBundle(original, ["a.example"], "0.8.0"))), original);
  assert.deepEqual(back.settings, original);
  assert.deepEqual(back.whitelist, ["a.example"]);
});

test("el fuente no lleva caracteres invisibles", () => {
  // Un carácter bidi crudo en el código cambia lo que se LEE sin cambiar lo que
  // se ejecuta («Trojan Source»). Donde hagan falta, van como escape.
  const bad = (c) => (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069) || (c >= 0x200b && c <= 0x200f);
  const files = ["src", "src/lib", "ui", "tests", "scripts"].flatMap((d) =>
    readdirSync(new URL(`../${d}/`, import.meta.url))
      .filter((f) => /\.(m?js|html|css)$/.test(f))
      .map((f) => `${d}/${f}`)
  );
  assert.ok(files.length > 20);
  for (const f of files) {
    const n = [...read(f)].filter((ch) => bad(ch.codePointAt(0))).length;
    assert.equal(n, 0, `${f}: ${n} caracteres invisibles`);
  }
});
