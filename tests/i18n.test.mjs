// Catálogos de idioma. t() devuelve la CLAVE literal cuando falta un mensaje,
// así que un hueco no rompe nada: simplemente aparece "fAlgoTitle" en la
// interfaz de quien use ese idioma. Estos tests lo cazan antes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DETECTORS, GROUPS } from "../src/settings.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const langs = readdirSync(new URL("_locales/", root));
const catalogs = Object.fromEntries(langs.map((l) => [l, JSON.parse(read(`_locales/${l}/messages.json`))]));
const base = catalogs.es;

test("hay al menos los 7 idiomas y el de por defecto existe", () => {
  assert.ok(langs.length >= 7, langs.join(", "));
  assert.equal(JSON.parse(read("manifest.json")).default_locale, "es");
  assert.ok(base);
});

test("todos los idiomas tienen exactamente las mismas claves", () => {
  const want = Object.keys(base).sort();
  for (const l of langs) {
    const have = Object.keys(catalogs[l]).sort();
    const missing = want.filter((k) => !(k in catalogs[l]));
    const extra = have.filter((k) => !(k in base));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `idioma ${l}`);
  }
});

test("ningún mensaje vacío y los mismos $1…$n en todos los idiomas", () => {
  const slots = (s) => [...new Set(s.match(/\$[1-9]/g) || [])].sort().join("");
  for (const l of langs) {
    for (const [k, v] of Object.entries(catalogs[l])) {
      assert.equal(typeof v.message, "string", `${l}.${k}`);
      assert.ok(v.message.trim().length > 0, `${l}.${k} está vacío`);
      assert.equal(slots(v.message), slots(base[k].message), `${l}.${k}: parámetros distintos a los del español`);
    }
  }
});

test("el nombre y la descripción caben en los límites de la Web Store", () => {
  for (const l of langs) {
    assert.ok(catalogs[l].extName.message.length <= 45, `${l}.extName`);
    assert.ok(catalogs[l].extDesc.message.length <= 132, `${l}.extDesc (${catalogs[l].extDesc.message.length})`);
  }
});

test("cada detector y cada grupo tiene su etiqueta y su consejo", () => {
  for (const d of DETECTORS) assert.ok(base[`det_${d.key}`], `falta det_${d.key}`);
  for (const g of GROUPS) {
    assert.ok(base[`grp_${g}`], `falta grp_${g}`);
    assert.ok(base[`adv_${g}`], `falta adv_${g}`);
  }
});

test("toda clave usada en el código existe en el catálogo", () => {
  const files = [
    "manifest.json",
    ...readdirSync(new URL("src/", root)).filter((f) => f.endsWith(".js")).map((f) => `src/${f}`),
    ...readdirSync(new URL("src/lib/", root)).map((f) => `src/lib/${f}`),
    ...readdirSync(new URL("ui/", root)).filter((f) => /\.(js|html)$/.test(f)).map((f) => `ui/${f}`),
  ];
  const used = new Map(); // clave -> fichero
  const note = (k, f) => used.has(k) || used.set(k, f);
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) note(m[1], f);
    for (const m of src.matchAll(/data-i18n(?:-title|-placeholder)?="([A-Za-z0-9_]+)"/g)) note(m[1], f);
    for (const m of src.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) note(m[1], f);
    // Tablas que montan la clave como `${key}Title` / `${key}Detail`.
    for (const m of src.matchAll(/\bkey: "(f[A-Z][A-Za-z0-9]+)"/g)) {
      note(`${m[1]}Title`, f);
      note(`${m[1]}Detail`, f);
    }
    // Claves elegidas con un ternario: t(cond ? "a" : "b").
    for (const m of src.matchAll(/\bt\([^)"]*\?\s*"([A-Za-z0-9_]+)"\s*:\s*"([A-Za-z0-9_]+)"/g)) {
      note(m[1], f);
      note(m[2], f);
    }
  }
  // Claves que se eligen por variable y los patrones de arriba no ven.
  for (const k of ["uStatusSafe", "uStatusWarning", "uStatusDanger", "uReportErr", "uReportOk", "uReportDup", "uReportNoServer", "oImportOk", "oImportErr"]) {
    note(k, "(dinámica)");
  }
  assert.ok(used.size > 150, `solo se han encontrado ${used.size} claves: ¿ha cambiado la forma de llamar a t()?`);
  const missing = [...used].filter(([k]) => !(k in base)).map(([k, f]) => `${k} (${f})`);
  assert.deepEqual(missing, []);
});

test("no quedan claves huérfanas en el catálogo", () => {
  const all = ["manifest.json", "src/background.js", "src/content.js", "src/search-guard.js", "src/settings.js",
    ...readdirSync(new URL("src/lib/", root)).map((f) => `src/lib/${f}`),
    ...readdirSync(new URL("ui/", root)).filter((f) => /\.(js|html)$/.test(f)).map((f) => `ui/${f}`),
  ].map(read).join("\n");
  const orphan = Object.keys(base).filter((k) => {
    if (/^(det|grp|adv)_/.test(k)) return false; // se montan a partir de DETECTORS / GROUPS
    const stem = k.replace(/(Title|Detail)$/, "");
    return !all.includes(k) && !all.includes(`"${stem}"`);
  });
  assert.deepEqual(orphan, []);
});
