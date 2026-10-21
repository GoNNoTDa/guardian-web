// Copia la extensión a dist/extension, lista para "Cargar descomprimida" en
// chrome://extensions. Solo lleva lo que la extensión necesita (lo mismo que
// el paquete de build.ps1): sin servidor, test-lab, docs ni git.
// Uso:  node scripts/sync-unpacked.mjs
//
// Se puede lanzar tras cada cambio: rehace la carpeta entera, así un fichero
// borrado en el repo tampoco se queda en la copia. Chrome no recarga solo:
// tras sincronizar, pulsa ↻ en la tarjeta de la extensión.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "extension");
const NEEDED = ["manifest.json", "src", "ui", "icons", "_locales"];

const missing = NEEDED.filter((p) => !existsSync(join(root, p)));
if (missing.length) {
  console.error(`Falta ${missing.join(", ")}: no se toca la copia anterior.`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const p of NEEDED) cpSync(join(root, p), join(out, p), { recursive: true });

if (!process.argv.includes("--quiet")) console.log(`Extensión sincronizada en ${out}`);
