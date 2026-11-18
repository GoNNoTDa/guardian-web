// Dominios que suplantan a una marca. Cada caso de «no debe saltar» está aquí
// porque es un falso positivo que costaría la confianza del usuario.
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHost, levenshtein, punyDecode, skeleton } from "../src/lib/lookalike.js";

const kind = (h) => analyzeHost(h)?.kind ?? null;

test("los dominios de la propia marca no saltan", () => {
  for (const h of ["bbva.es", "www.bbva.es", "login.caixabank.es", "sede.agenciatributaria.gob.es", "accounts.google.com"]) {
    assert.equal(analyzeHost(h), null, h);
  }
});

test("webs corrientes no saltan", () => {
  const legit = [
    "elpais.com", "wikipedia.org", "idealista.com", "finance.yahoo.com", "github.io", "ine.es",
    "boe.es", "renfe.es", "x.com", "minted.com", "finance.com", "marketing.es.ejemplo.com",
    "microsoftonline.com", "login.microsoftonline.com", "amazonpay.com", "paypalobjects.com",
    "googleusercontent.com", "googleapis.com", "orange-juice.com", "santander-turismo.es",
    "apple-pie.org", "booking-agent.net", "example.com", "localhost", "127.0.0.1", "192.168.1.1",
  ];
  for (const h of legit) assert.equal(analyzeHost(h), null, h);
});

test("marcas globales bajo otro TLD de país no saltan", () => {
  for (const h of ["google.fr", "amazon.de", "ebay.co.uk", "vodafone.de", "santander.co.uk", "apple.es"]) {
    assert.equal(analyzeHost(h), null, h);
  }
});

test("homógrafos: leet, cirílico y punycode", () => {
  assert.deepEqual(
    { kind: kind("g00gle.com"), brand: analyzeHost("g00gle.com").brand, weight: analyzeHost("g00gle.com").weight },
    { kind: "homograph", brand: "google.com", weight: 80 }
  );
  assert.equal(kind("faceb00k.com"), "homograph");
  assert.equal(kind("login.paypa1.com"), "homograph");
  assert.equal(kind("xn--pypal-4ve.com"), "homograph"); // "pаypal" con a cirílica
  assert.equal(kind("раураl.com"), "homograph"); // el mismo, sin codificar
});

test("la marca como subdominio de otro dominio", () => {
  const r = analyzeHost("bbva.es.verificar-cuenta.top");
  assert.equal(r.kind, "brandsub");
  assert.equal(r.brand, "bbva.es");
  assert.equal(r.reg, "verificar-cuenta.top");
  assert.equal(r.weight, 60);
  assert.equal(kind("netflix.com.cuenta-pago.info"), "brandsub");
  assert.equal(kind("ing.es.clientes.top"), "brandsub");
});

test("typosquatting, también con subdominios delante", () => {
  assert.equal(kind("paypall.com"), "typo");
  assert.equal(kind("gogle.com"), "typo");
  assert.equal(kind("secure.paypall.com"), "typo");
  assert.equal(kind("caixabanc.es"), "typo");
  assert.equal(analyzeHost("paypall.com").weight, 60);
});

test("marca + gancho: por debajo del umbral de aviso por sí sola", () => {
  for (const h of ["paypal-login.top", "caixabank-seguro.top", "bancosantander-acceso.com", "correos-envios.com", "bbva-es.top"]) {
    const r = analyzeHost(h);
    assert.equal(r?.kind, "combo", h);
    assert.equal(r.weight, 45, h);
  }
  // Pegado y sin gancho pesan menos.
  assert.equal(analyzeHost("paypallogin.com").weight, 35);
  assert.equal(analyzeHost("instagram-engineering.com").weight, 30);
  for (const h of ["paypal-login.top", "paypallogin.com"]) assert.ok(analyzeHost(h).weight < 50, h);
});

test("la marca con otra terminación", () => {
  const r = analyzeHost("agenciatributaria.com");
  assert.equal(r.kind, "othertld");
  assert.equal(r.weight, 30);
  assert.equal(kind("caixabank.top"), "othertld");
  assert.equal(kind("amazon.shop"), "othertld"); // global, pero bajo un TLD raro
  assert.equal(kind("paypal.tk"), "othertld"); // dos letras, pero de la lista de abuso
});

test("la marca en subdominio se reconoce también disfrazada", () => {
  assert.equal(kind("g00gle.com.login.top"), "brandsub");
  assert.equal(analyzeHost("g00gle.com.login.top").brand, "google.com");
});

test("entradas raras no rompen", () => {
  for (const h of ["", null, undefined, "com", "xn--", "xn--a.xn--b", ".", "a..b", "[::1]"]) {
    assert.doesNotThrow(() => analyzeHost(h), String(h));
  }
  assert.equal(analyzeHost(""), null);
});

test("levenshtein", () => {
  assert.equal(levenshtein("", ""), 0);
  assert.equal(levenshtein("abc", ""), 3);
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("paypal.com", "paypall.com"), 1);
});

test("punycode", () => {
  assert.equal(punyDecode("mnchen-3ya"), "münchen");
  assert.equal(punyDecode("espaa-rta"), "españa");
  assert.equal(skeleton("xn--espaa-rta.es"), "españa.es");
  // Una etiqueta corrupta se devuelve tal cual, sin colgarse.
  assert.equal(punyDecode("!!!"), "!!!");
});
