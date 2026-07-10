// Listas negras locales y heurísticas de dominio.
// Nota: son un punto de partida. En producción conviene actualizarlas desde
// una fuente externa (URLhaus, hostfiles, etc.) en lugar de embeberlas.

// Dominios de minado de criptomonedas conocidos (cryptojacking).
export const MINING_HOSTS = [
  "coinhive.com",
  "coin-hive.com",
  "authedmine.com",
  "cnhv.co",
  "jsecoin.com",
  "cryptoloot.pro",
  "crypto-loot.com",
  "coinimp.com",
  "webmine.cz",
  "webminepool.com",
  "minero.cc",
  "2giga.link",
  "ppoi.org",
  "coinpot.co",
];

// TLDs con tasa de abuso históricamente alta. Señal MUY débil: solo suma
// unos pocos puntos, nunca dispara un aviso por sí sola.
const BAD_TLDS = [".tk", ".gq", ".ml", ".cf", ".ga", ".zip", ".mov"];

export function isSuspiciousTld(host) {
  return BAD_TLDS.some((tld) => host.endsWith(tld));
}
