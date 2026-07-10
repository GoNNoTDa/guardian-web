// Aprendizaje heurístico de rastreadores al estilo de Privacy Badger, pero
// 100% local: en vez de listas, se APRENDE. Si el mismo dominio de terceros
// aparece rastreando en 3+ sitios distintos, se marca como rastreador.
//
// Nota de privacidad (lección aprendida de Privacy Badger): el aprendizaje
// activo puede convertirse en vector de fingerprinting si se expusiera lo que
// se bloquea. Aquí NO bloqueamos y NO exponemos la lista aprendida a las
// páginas: solo se usa internamente para puntuar. Riesgo neutralizado.

const PROMOTE_AT = 3; // nº de sitios distintos para considerar rastreador
const MAX_HOSTS = 4000; // techo para no inflar el storage

let mem = null; // { host: [site1, site2, site3] }
let known = null; // Set de hosts ya promovidos a "rastreador"
let saveTimer = null;

async function load() {
  if (mem) return;
  const o = await chrome.storage.local.get(["trackerMem", "trackerKnown"]);
  mem = o.trackerMem || {};
  known = new Set(o.trackerKnown || []);
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await chrome.storage.local.set({ trackerMem: mem, trackerKnown: [...known] });
    } catch {
      /* storage lleno o contexto muerto: se reintenta en el próximo cambio */
    }
  }, 15000); // debounce: como mucho una escritura cada 15 s
}

// Registra que `host` (tercero) aparece en `site`. Devuelve true si con esto
// acaba de promoverse a rastreador conocido.
export async function noteThirdParty(site, host) {
  await load();
  if (!site || !host || site === host) return false;
  if (known.has(host)) return false;
  if (!mem[host] && Object.keys(mem).length >= MAX_HOSTS) return false;

  const sites = mem[host] || [];
  if (sites.includes(site)) return false;
  sites.push(site);
  mem[host] = sites;

  let promoted = false;
  if (sites.length >= PROMOTE_AT) {
    known.add(host);
    delete mem[host]; // ya no hace falta acumular sus sitios
    promoted = true;
  }
  scheduleSave();
  return promoted;
}

export async function isKnownTracker(host) {
  await load();
  return known.has(host);
}
