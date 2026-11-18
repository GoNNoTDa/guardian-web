// Prueba de punta a punta, sin dependencias: abre un Chrome de verdad con la
// extensión cargada, recorre el test-lab y comprueba que cada página dispara
// sus señales (y que clean.html no dispara ninguna).
//
// Uso:  node scripts/e2e.mjs            (sin ventana)
//       node scripts/e2e.mjs --headed   (viendo el navegador)
//       node scripts/e2e.mjs --shots=carpeta   (guarda capturas del banner y la UI)
//       CHROME_PATH=/ruta/a/chrome node scripts/e2e.mjs
//
// Cómo funciona: Chrome se lanza con un perfil temporal y se controla por el
// protocolo DevTools a través de una tubería (--remote-debugging-pipe), que es
// la única vía por la que hoy se puede cargar una extensión sin empaquetar
// desde fuera (Extensions.loadUnpacked). El estado de cada pestaña se lee del
// propio service worker de la extensión. Los dominios falsos (g00gle.com…)
// se resuelven a 127.0.0.1 con --host-resolver-rules: no hace falta tocar el
// fichero hosts y no sale nada a Internet.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8137;
const LAB = `http://127.0.0.1:${PORT}`;
const headed = process.argv.includes("--headed");
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const shotsDir = shotsArg ? resolve(shotsArg.slice(8)) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dominios de mentira para el análisis del nombre del host.
const FAKE_HOSTS = ["g00gle.com", "paypall.com", "bbva.es.verificar-cuenta.top", "paypal-login.top", "google.fr"];

// Cada caso: página, señales que DEBEN aparecer (prefijo del id), señales que
// NO deben aparecer, nivel esperado y, si hace falta, botones que pulsar.
const CASES = [
  { url: "/clean.html", level: "safe", none: true },
  { url: "/scam.html", has: ["scam-text", "hidden-iframes"], level: "warning" },
  { url: "/phishing-form.html", has: ["pwd-http", "pwd-cross"], level: "warning" },
  { url: "/bitb.html", has: ["fakewindow", "pwd-http"], level: "danger" },
  { url: "/brand-login.html", has: ["brandform", "pwd-http"], level: "danger" },
  { url: "/brand-mention.html", has: ["pwd-http"], not: ["brandform"], level: "warning" },
  { url: "/fingerprint.html", has: ["fp-canvas", "perm-geo", "perm-notif"], level: "warning" },
  { url: "/mining.html", has: ["fp-mining"], level: "safe" },
  { url: "/third-parties.html", has: ["many-third-parties"], level: "safe" },
  { url: "/go", has: ["redirect-chain"], level: "safe" },
  { url: "/locker.html", has: ["locker:history"], level: "safe" },
  { url: "/notif-bait.html", has: ["perm-notif", "notifbait", "notifbait:sw"], level: "warning" },
  { url: "/svg-script.html", has: ["svgscript:inline", "svgscript:embed"], level: "warning" },
  { url: "/malicious.svg", has: ["svgscript:document"], level: "warning" },
  { url: "/prompt-injection.html", has: ["promptinject"], level: "safe" },
  { url: "/smuggling.html", has: ["smuggling"], level: "safe" },
  { url: "/danger-combo.html", has: ["scam-text", "hidden-iframes", "pwd-http", "fp-canvas"], level: "danger" },
  { url: "/exfil.html", click: ["go"], has: ["exfil:", "pwd-http"], level: "danger" },
  { url: "/exfil-encoded.html", click: ["pixel"], has: ["exfil:"], level: "warning" },
  { url: "/exfil-encoded.html", click: ["socket"], has: ["exfil:"], level: "warning" },
  { url: "/exfil-encoded.html", click: ["propio"], not: ["exfil:", "skimmer:"], level: "safe" },
  { url: "/skimmer.html", click: ["go"], has: ["skimmer:"], not: ["exfil:"], level: "warning" },
  { url: "/clickfix.html", click: ["pad"], has: ["clickfix:lure", "clickfix:pad"], level: "danger" },
  // El banner sale en naranja al cargar y debe pasar a rojo con la firma.
  { url: "/web3-drainer.html", has: ["seedphrase"], level: "warning", banner: "warning", shot: "banner-naranja" },
  { url: "/web3-drainer.html", click: ["ethsign"], has: ["seedphrase", "web3:ethsign"], level: "danger", banner: "danger", shot: "banner-rojo" },
  // Nombre del dominio (lib/lookalike.js), sin tocar el fichero hosts.
  { url: `http://g00gle.com:${PORT}/clean.html`, has: ["homograph:google.com"], level: "warning" },
  { url: `http://paypall.com:${PORT}/clean.html`, has: ["typo:paypal.com"], level: "warning" },
  { url: `http://bbva.es.verificar-cuenta.top:${PORT}/clean.html`, has: ["brand-sub:bbva.es"], level: "warning" },
  { url: `http://paypal-login.top:${PORT}/clean.html`, has: ["combo:paypal.com"], level: "warning" },
  { url: `http://google.fr:${PORT}/clean.html`, not: ["other-tld", "typo", "homograph", "combo"], level: "safe" },
];

function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && existsSync(env)) return env;
  const pf = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...pf.map((p) => join(p, "Google/Chrome/Application/chrome.exe")),
    ...pf.map((p) => join(p, "Chromium/Application/chrome.exe")),
    ...pf.map((p) => join(p, "Microsoft/Edge/Application/msedge.exe")),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

// Cliente mínimo del protocolo DevTools sobre tubería: mensajes JSON separados
// por un byte nulo.
class Cdp {
  constructor(proc) {
    this.out = proc.stdio[3];
    this.next = 0;
    this.pending = new Map();
    this.waiters = [];
    let buf = Buffer.alloc(0);
    proc.stdio[4].on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let i;
      while ((i = buf.indexOf(0)) >= 0) {
        const msg = JSON.parse(buf.subarray(0, i).toString("utf8"));
        buf = buf.subarray(i + 1);
        if (msg.id && this.pending.has(msg.id)) {
          const { ok, ko, method } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) ko(new Error(`${method}: ${msg.error.message}`));
          else ok(msg.result);
        } else if (msg.method) {
          this.waiters = this.waiters.filter((w) => !w(msg));
        }
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((ok, ko) => {
      this.pending.set(id, { ok, ko, method });
      this.out.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
  }
  // Espera un evento que cumpla el filtro (o se rinde a los `ms`).
  event(match, ms = 15000) {
    return new Promise((ok) => {
      const timer = setTimeout(() => ok(null), ms);
      this.waiters.push((msg) => {
        if (!match(msg)) return false;
        clearTimeout(timer);
        ok(msg);
        return true;
      });
    });
  }
  async evaluate(sessionId, expression, extra = {}) {
    const r = await this.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true, ...extra },
      sessionId
    );
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
}

async function startLab() {
  const proc = spawn(process.execPath, [join(root, "test-lab", "server.js")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${LAB}/clean.html`)).ok) return proc;
    } catch {
      /* todavía arrancando */
    }
    await sleep(100);
  }
  proc.kill();
  throw new Error(`el test-lab no responde en ${LAB}`);
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("No encuentro Chrome, Chromium ni Edge. Indica la ruta en CHROME_PATH.");
    process.exit(2);
  }
  // La misma copia que se carga a mano en chrome://extensions.
  await import("./sync-unpacked.mjs").catch(() => {});
  const extDir = join(root, "dist", "extension");
  if (!existsSync(join(extDir, "manifest.json"))) {
    // sync-unpacked termina el proceso si falla; si llegamos aquí sin copia, algo raro pasa.
    throw new Error(`no existe ${extDir}`);
  }

  const lab = await startLab();
  const profile = mkdtempSync(join(tmpdir(), "guardian-e2e-"));
  const chrome = spawn(
    browser,
    [
      `--user-data-dir=${profile}`,
      "--remote-debugging-pipe",
      "--enable-unsafe-extension-debugging",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-search-engine-choice-screen",
      "--window-size=1100,800",
      `--host-resolver-rules=${FAKE_HOSTS.map((h) => `MAP ${h} 127.0.0.1`).join(", ")}`,
      ...(headed ? [] : ["--headless=new"]),
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
  );
  const cdp = new Cdp(chrome);
  let failed = 0;

  try {
    const { id: extId } = await cdp.send("Extensions.loadUnpacked", { path: extDir });
    const swUrl = `chrome-extension://${extId}/`;

    // Sesión con el service worker (se vuelve a buscar si Chrome lo ha dormido).
    let swSession = null;
    const sw = async (expression) => {
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          if (!swSession) {
            const { targetInfos } = await cdp.send("Target.getTargets");
            const t = targetInfos.find((x) => x.type === "service_worker" && x.url.startsWith(swUrl));
            if (!t) throw new Error("service worker dormido");
            swSession = (await cdp.send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).sessionId;
          }
          return await cdp.evaluate(swSession, expression);
        } catch (e) {
          swSession = null;
          if (attempt === 19) throw e;
          await sleep(250);
        }
      }
    };

    // Sin notificaciones del sistema ni consultas a la red durante la prueba.
    await sw(`chrome.storage.local.set({ settings: { localMode: true, notifications: false } })`);
    await sleep(300);

    const stateOf = async (pageUrl) => {
      const raw = await sw(`(async () => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((t) => t.url === ${JSON.stringify(pageUrl)});
        if (!tab) return JSON.stringify({ error: "pestaña no encontrada", urls: tabs.map((t) => t.url) });
        const key = "tab:" + tab.id;
        const st = (await chrome.storage.session.get(key))[key];
        return JSON.stringify({ tabId: tab.id, st: st || null });
      })()`);
      return JSON.parse(raw);
    };

    const open = async (url) => {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      const loaded = cdp.event((m) => m.method === "Page.loadEventFired" && m.sessionId === sessionId, 15000);
      await cdp.send("Page.navigate", { url }, sessionId);
      await loaded;
      return { targetId, sessionId };
    };

    // El banner vive en un shadow root cerrado: solo se ve desde DevTools.
    const bannerHtml = async (sessionId) => {
      const { root: doc } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
      let bar = null;
      const walk = (n) => {
        if (bar) return;
        const attrs = n.attributes || [];
        const cls = attrs[attrs.indexOf("class") + 1] || "";
        if (attrs.includes("class") && /^bar( open)?$/.test(cls) && n.nodeName === "DIV") bar = n;
        for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c);
      };
      walk(doc);
      if (!bar) return null;
      return (await cdp.send("DOM.getOuterHTML", { nodeId: bar.parentId ?? bar.nodeId }, sessionId)).outerHTML;
    };

    const shot = async (sessionId, name) => {
      if (!shotsDir) return;
      mkdirSync(shotsDir, { recursive: true });
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
      writeFileSync(join(shotsDir, `${name}.png`), Buffer.from(data, "base64"));
    };

    for (const c of CASES) {
      const url = c.url.startsWith("http") ? c.url : LAB + c.url;
      const label = (c.url.startsWith("http") ? new URL(c.url).hostname : c.url) + (c.click ? ` [${c.click}]` : "");
      const problems = [];
      const page = await open(url);
      try {
        // document_idle + el primer reescaneo del DOM (1,5 s).
        await sleep(2600);
        for (const id of c.click || []) {
          await cdp.evaluate(page.sessionId, `document.getElementById(${JSON.stringify(id)}).click()`, { userGesture: true });
          await sleep(1500);
        }
        const finalUrl = await cdp.evaluate(page.sessionId, "location.href");
        const { st, error } = await stateOf(finalUrl);
        if (error || !st) {
          problems.push(error || "sin estado para la pestaña");
        } else {
          const ids = st.findings.map((f) => f.id);
          for (const want of c.has || []) {
            if (!ids.some((id) => id === want || id.startsWith(want))) problems.push(`falta ${want}`);
          }
          for (const bad of c.not || []) {
            if (ids.some((id) => id.startsWith(bad))) problems.push(`sobra ${bad}`);
          }
          if (c.none && ids.length) problems.push(`debía estar limpia y trae: ${ids.join(", ")}`);
          if (c.level && st.level !== c.level) problems.push(`nivel ${st.level} (${st.score}), esperado ${c.level}`);
          for (const f of st.findings) {
            if (!f.title || /^f[A-Z]\w+(Title|Detail)$/.test(f.title) || /^f[A-Z]\w+Detail$/.test(f.detail)) {
              problems.push(`texto sin traducir en ${f.id}`);
            }
          }
          if (c.banner) {
            const html = await bannerHtml(page.sessionId);
            const color = c.banner === "danger" ? "#a8201a" : "#8f4a07";
            if (!html) problems.push("no hay banner en la página");
            else if (!html.includes(`background: ${color}`)) problems.push(`el banner no está en ${c.banner}`);
            else if (!html.includes('class="adv"')) problems.push("el banner no lleva el consejo");
          }
          if (c.shot) await shot(page.sessionId, c.shot);
          if (!problems.length) console.log(`  ok   ${label.padEnd(44)} ${st.level} ${st.score}  [${ids.join(", ")}]`);
        }
      } catch (e) {
        problems.push(e.message);
      }
      if (problems.length) {
        failed++;
        console.log(`  FALLA ${label}\n         ${problems.join("\n         ")}`);
      }
      await cdp.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
    }

    // --- Interfaz: popup con un aviso de verdad, y página de opciones --------
    const stats = JSON.parse(await sw(`chrome.storage.local.get("stats").then((o) => JSON.stringify(o.stats || {}))`));
    const month = Object.values(stats)[0] || {};
    const total = Object.values(month).reduce((a, b) => a + b, 0);
    if (total < 10) {
      failed++;
      console.log(`  FALLA resumen mensual: solo ${total} avisos contados (${JSON.stringify(stats)})`);
    } else {
      console.log(`  ok   resumen mensual                              ${JSON.stringify(month)}`);
    }

    {
      // El popup se abre como pestaña haciéndole creer que la pestaña activa es
      // la del laboratorio, para ver el aviso, el consejo y el resumen pintados.
      const target = await open(`${LAB}/web3-drainer.html`);
      await sleep(2600);
      const { tabId } = await stateOf(`${LAB}/web3-drainer.html`);
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {
          source: `chrome.tabs.query = async () => [{ id: ${tabId}, windowId: 1, url: ${JSON.stringify(LAB + "/web3-drainer.html")}, active: true }];`,
        },
        sessionId
      );
      const problems = [];
      for (const [pageName, checks] of [
        ["popup", ["#advice:not([hidden])", "#stats:not([hidden])", "#reasons li", "#meter:not([hidden])"]],
        ["options", ["#exportBtn", "#importBtn", "#detectors input[data-key='typosquat']"]],
      ]) {
        const loaded = cdp.event((m) => m.method === "Page.loadEventFired" && m.sessionId === sessionId);
        await cdp.send("Page.navigate", { url: `${swUrl}ui/${pageName}.html` }, sessionId);
        await loaded;
        await sleep(900);
        for (const sel of checks) {
          if (!(await cdp.evaluate(sessionId, `!!document.querySelector(${JSON.stringify(sel)})`))) {
            problems.push(`${pageName}: falta ${sel}`);
          }
        }
        const untranslated = await cdp.evaluate(
          sessionId,
          `[...document.querySelectorAll("body *")].filter((e) => !e.children.length && /^(u|o|f|b|adv_|det_|grp_)[A-Za-z_]+$/.test(e.textContent.trim()) && /[a-z][A-Z]|_/.test(e.textContent)).map((e) => e.textContent.trim()).join(", ")`
        );
        if (untranslated) problems.push(`${pageName}: claves sin traducir: ${untranslated}`);
        await shot(sessionId, pageName);

        // Confiar en el sitio desde el popup lo silencia; dejar de confiar lo
        // devuelve a la vigilancia sin esperar a otra navegación.
        if (pageName === "popup") {
          const trusted = async () => (await stateOf(`${LAB}/web3-drainer.html`)).st;
          await cdp.evaluate(sessionId, `document.getElementById("trustBtn").click()`, { userGesture: true });
          await sleep(700);
          let st = await trusted();
          if (!st.whitelisted || st.findings.length) problems.push("popup: confiar no silencia el sitio");
          await cdp.evaluate(sessionId, `document.getElementById("trustBtn").click()`, { userGesture: true });
          await sleep(700);
          st = await trusted();
          if (st.whitelisted) problems.push("popup: dejar de confiar no devuelve la vigilancia");
        }
      }
      if (problems.length) {
        failed++;
        console.log(`  FALLA interfaz\n         ${problems.join("\n         ")}`);
      } else {
        console.log("  ok   interfaz (popup con aviso, consejo y resumen; opciones)");
      }
      await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
      await cdp.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
    }

    // Errores que la propia extensión haya dejado en el service worker.
    const total2 = CASES.length + 2;
    console.log(failed ? `\n${failed} de ${total2} comprobaciones han fallado.` : `\nLas ${total2} comprobaciones pasan.`);
  } finally {
    await cdp.send("Browser.close").catch(() => {});
    await sleep(500);
    chrome.kill();
    lab.kill();
    for (let i = 0; i < 10; i++) {
      try {
        rmSync(profile, { recursive: true, force: true });
        break;
      } catch {
        await sleep(300); // Chrome aún suelta ficheros del perfil
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
