// Análisis del NOMBRE de una descarga (A3): ejecutables de riesgo y "doble
// extensión" (factura.pdf.exe). Módulo puro: devuelve qué ha visto y con qué
// peso; los textos los pone el service worker.

const RISKY_EXT = new Set([
  "exe", "scr", "com", "pif", "bat", "cmd", "msi", "msp", "hta", "cpl", "jar",
  "js", "jse", "vbs", "vbe", "wsf", "wsh", "ps1", "psm1", "reg", "lnk", "inf",
  "dll", "gadget", "apk", "app", "dmg", "iso", "img", "msix", "appx", "vhd", "url",
]);
const DOC_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "jpg",
  "jpeg", "png", "gif", "csv", "zip", "rar", "mp3", "mp4",
]);

// Caracteres que invierten o esconden el orden del texto. El clásico es
// U+202E: "factura[U+202E]fdp.exe" se LEE "facturaexe.pdf" en el explorador.
const BIDI = /[\u202a-\u202e\u2066-\u2069\u200e\u200f]/;

// Devuelve null o { kind: "bidi" | "double" | "exe", weight, name, ext, prev }.
export function analyzeDownload(nameOrUrl) {
  let clean = String(nameOrUrl || "");
  // Si es una URL, quedarse con la ruta: "?x=.exe" no es una extensión.
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) && !/^[a-z]:[\\/]/i.test(clean)) {
    try {
      clean = decodeURIComponent(new URL(clean).pathname);
    } catch {
      return null;
    }
  }
  clean = clean.split(/[\\/]/).pop().trim().toLowerCase();
  // Windows ignora los puntos y espacios finales: "foto.jpg.exe . " es un .exe.
  clean = clean.replace(/[. ]+$/, "");
  const bidi = BIDI.test(clean);
  const parts = clean.replace(new RegExp(BIDI.source, "g"), "").split(".");
  if (parts.length < 2) return null;
  const ext = parts.pop().trim();
  const prev = parts.length ? parts[parts.length - 1].trim() : "";
  if (!RISKY_EXT.has(ext)) return null;

  const base = { name: clean.replace(new RegExp(BIDI.source, "g"), ""), ext, prev };
  if (bidi) return { kind: "bidi", weight: 90, ...base };
  if (DOC_EXT.has(prev)) return { kind: "double", weight: 90, ...base };
  return { kind: "exe", weight: 45, ...base };
}
