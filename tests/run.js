// Tests end-to-end de Guardián Web (C4).
// Carga la extensión real en Chrome con Puppeteer, recorre el test-lab y
// verifica que cada página dispara exactamente los detectores esperados,
// leyendo el estado del service worker (chrome.storage.session).
//
// Uso:  cd tests && npm install && npm test
// Requiere Node 18+. Arranca el servidor del test-lab por su cuenta.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIR = path.resolve(__dirname, "..");
const LAB = path.join(EXT_DIR, "test-lab", "server.js");
const BASE = "http://127.0.0.1:8000";

// Cada caso: página -> prefijos de finding esperados (subconjunto que DEBE
// aparecer). null = no debe aparecer ninguno.
const CASES = [
  { name: "clean", url: "/clean.html", expect: [] },
  { name: "scam", url: "/scam.html", expect: ["scam-text", "hidden-iframes"] },
  { name: "phishing-form", url: "/phishing-form.html", expect: ["pwd-http", "pwd-cross"] },
  { name: "fingerprint", url: "/fingerprint.html", expect: ["fp-canvas", "perm-geo", "perm-notif"] },
  { name: "mining", url: "/mining.html", expect: ["fp-mining"] },
  { name: "third-parties", url: "/third-parties.html", expect: ["many-third-parties"] },
  { name: "redirects", url: "/go", expect: ["redirect-chain"], host: "127.0.0.1" },
  { name: "exfil", url: "/exfil.html", expect: ["exfil"], click: "#go" },
  { name: "skimmer", url: "/skimmer.html", expect: ["skimmer"], click: "#go" },
  { name: "locker", url: "/locker.html", expect: ["locker"] },
];

function waitForServer(url, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (r) => {
          r.destroy();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("servidor no responde"));
          else setTimeout(tick, 200);
        });
    };
    tick();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lee los ids de finding del estado de la pestaña cuyo host coincide.
async function findingsFor(worker, host) {
  return worker.evaluate(async (host) => {
    const all = await chrome.storage.session.get(null);
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("tab:") && v && v.host === host) {
        return (v.findings || []).map((f) => f.id);
      }
    }
    return null;
  }, host);
}

// Espera hasta que aparezcan todos los prefijos esperados (o se agote el tiempo).
async function waitForFindings(worker, host, expected, timeoutMs = 8000) {
  const start = Date.now();
  let ids = [];
  while (Date.now() - start < timeoutMs) {
    ids = (await findingsFor(worker, host)) || [];
    const prefixes = ids.map((id) => id.split(":")[0]);
    if (expected.every((e) => prefixes.includes(e))) return ids;
    await sleep(300);
  }
  return ids;
}

async function main() {
  // 1) Arrancar el servidor del test-lab.
  const server = spawn(process.execPath, [LAB], { stdio: "ignore" });
  await waitForServer(BASE + "/index.html").catch(() => {
    throw new Error("No se pudo arrancar el test-lab en " + BASE);
  });

  // 2) Lanzar Chrome con la extensión cargada.
  // Si Puppeteer no ha descargado su Chrome, se puede indicar uno del sistema
  // con la variable de entorno PUPPETEER_EXECUTABLE_PATH.
  const launchOpts = {
    headless: "new",
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--no-sandbox",
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOpts);

  let pass = 0;
  let fail = 0;
  try {
    const page = await browser.newPage();
    // Aceptar/denegar diálogos de permisos sin bloquear.
    page.on("dialog", (d) => d.dismiss().catch(() => {}));

    // Los service workers de MV3 son perezosos: no arrancan hasta que ocurre
    // un evento. Navegar despierta al SW (webNavigation.onCommitted) y solo
    // entonces aparece su target.
    await page.goto(BASE + "/index.html", { waitUntil: "networkidle2" }).catch(() => {});
    let swTarget;
    try {
      swTarget = await browser.waitForTarget((t) => t.type() === "service_worker", {
        timeout: 10000,
      });
    } catch {
      throw new Error(
        "No apareció el service worker de la extensión. En algunos entornos " +
          "(Chrome corporativo con políticas, o headless antiguo) no se puede " +
          "cargar la extensión con --load-extension. Prueba en una máquina sin " +
          "políticas de gestión o en CI con Chrome for Testing."
      );
    }
    const worker = await swTarget.worker();

    for (const c of CASES) {
      const host = c.host || "127.0.0.1";
      await page.goto(BASE + c.url, { waitUntil: "networkidle2" }).catch(() => {});
      if (c.click) {
        await page.click(c.click).catch(() => {});
      }

      const ids = await waitForFindings(worker, host, c.expect);
      const prefixes = ids.map((id) => id.split(":")[0]);

      let ok;
      if (c.expect.length === 0) {
        ok = prefixes.length === 0;
      } else {
        ok = c.expect.every((e) => prefixes.includes(e));
      }

      if (ok) {
        pass++;
        console.log(`  ✓ ${c.name} → [${prefixes.join(", ") || "sin señales"}]`);
      } else {
        fail++;
        console.log(`  ✗ ${c.name}`);
        console.log(`      esperado: [${c.expect.join(", ") || "ninguno"}]`);
        console.log(`      obtenido: [${prefixes.join(", ") || "ninguno"}]`);
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\nResultado: ${pass} OK, ${fail} fallos.`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("Error en el arranque de los tests:", e.message);
  process.exit(1);
});
