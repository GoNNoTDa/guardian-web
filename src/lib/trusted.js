// Lista embebida de dominios de confianza (A1). En estos sitios se suprimen
// las señales heurísticas (solo se avisa de amenazas CONFIRMADAS por las APIs
// de reputación, marcadas con `confirmed: true`). Reduce drásticamente los
// falsos positivos en la web "normal".
//
// Aparte de esta lista, el usuario tiene su propia whitelist personal
// (chrome.storage.local -> "whitelist"), que silencia TODOS los avisos.

export const TRUSTED_DOMAINS = [
  // Buscadores / tecnología
  "google.com", "google.es", "youtube.com", "bing.com", "duckduckgo.com",
  "yahoo.com", "microsoft.com", "live.com", "outlook.com", "office.com",
  "apple.com", "icloud.com", "mozilla.org", "cloudflare.com", "adobe.com",
  "zoom.us", "dropbox.com", "github.com", "stackoverflow.com", "wikipedia.org",
  "wordpress.com", "medium.com", "archive.org",
  // Redes sociales / mensajería
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "tiktok.com", "reddit.com", "pinterest.com", "twitch.tv", "telegram.org",
  "whatsapp.com", "discord.com",
  // Comercio / pagos / clasificados
  "amazon.com", "amazon.es", "ebay.com", "ebay.es", "aliexpress.com",
  "paypal.com", "booking.com", "airbnb.com", "elcorteingles.es",
  "mercadona.es", "wallapop.com", "vinted.es", "idealista.com", "fotocasa.es",
  // Streaming
  "netflix.com", "spotify.com", "hbomax.com", "disneyplus.com", "primevideo.com",
  // Cripto
  "binance.com", "coinbase.com", "kraken.com",
  // Banca España
  "bbva.es", "santander.com", "bancosantander.es", "caixabank.es",
  "bancsabadell.com", "bankinter.com", "unicajabanco.es", "abanca.com",
  "ing.es", "openbank.es", "evobanco.com", "kutxabank.es", "ibercaja.es",
  "cajamar.es", "bizum.es", "ruralvia.com",
  // Administración pública España
  "agenciatributaria.gob.es", "sede.agenciatributaria.gob.es", "seg-social.es",
  "sepe.es", "dgt.es", "correos.es", "boe.es", "ine.es",
  "administracion.gob.es", "clave.gob.es", "mjusticia.gob.es", "policia.es",
  "guardiacivil.es",
  // Telecos / energía
  "movistar.es", "vodafone.es", "orange.es", "masmovil.es",
  "iberdrola.es", "endesa.com", "naturgy.es", "holaluz.com",
  // Prensa
  "elpais.com", "elmundo.es", "abc.es", "lavanguardia.com",
  "elconfidencial.com", "20minutos.es", "rtve.es", "marca.com", "as.com",
  "expansion.com", "eleconomista.es",
  // Transporte
  "renfe.com", "iberia.com", "vueling.com", "ryanair.com", "alsa.es",
];

export function hostMatches(host, domain) {
  return host === domain || host.endsWith("." + domain);
}

export function isTrusted(host) {
  return TRUSTED_DOMAINS.some((d) => hostMatches(host, d));
}
