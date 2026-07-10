// Servidor del laboratorio de pruebas de Guardián Web.
// Sirve las páginas estáticas y añade una cadena de redirecciones para probar
// el detector "redirect-chain". SOLO escucha en 127.0.0.1.
//
// Uso:  node server.js   →  http://127.0.0.1:8000

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8000;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Cadena de redirecciones: /go -> /go2 -> ... -> /go5 -> redirect-final.html
  // (4+ saltos disparan la señal "redirect-chain", +20).
  const hop = url.pathname.match(/^\/go(\d?)$/);
  if (hop) {
    const n = parseInt(hop[1] || "1", 10);
    const next = n >= 5 ? "/redirect-final.html" : `/go${n + 1}`;
    res.writeHead(302, { Location: next });
    res.end();
    return;
  }

  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = path.normalize(file).replace(/^([.][.][/\\])+/, ""); // sin path traversal
  const full = path.join(ROOT, file);

  if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
    return;
  }

  res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Laboratorio de Guardián Web en http://127.0.0.1:${PORT}`);
  console.log("Ctrl+C para parar.");
});
