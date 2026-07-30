// Recursos educativos por vector (objetivo divulgativo del proyecto). Cada
// detector enlaza a material serio y gratuito donde ampliar conocimiento.
// Se elige el idioma del navegador: recursos en español (OSI/INCIBE/CCN-CERT)
// para es/ca, y de referencia internacional (OWASP/EFF/MDN) para el resto.
//
// El mapa va por CLAVE DE DETECTOR (la misma de settings.js), no por id de
// finding: así una sola entrada cubre todas las variantes de un vector.

const ES = {
  reputation: "https://www.osi.es/es/campanias/fraudes-en-la-red",
  community: "https://www.osi.es/es/campanias/fraudes-en-la-red",
  redirects: "https://www.incibe.es/aprendeciberseguridad/ingenieria-social",
  tld: "https://www.osi.es/es/actualidad/blog",
  rawip: "https://www.osi.es/es/actualidad/blog",
  weirdport: "https://www.osi.es/es/actualidad/blog",
  domainage: "https://www.incibe.es/aprendeciberseguridad/phishing",
  mining: "https://www.incibe.es/aprendeciberseguridad/malware",
  thirdparties: "https://www.osi.es/es/tu-informacion-personal",
  trackerlearn: "https://www.osi.es/es/tu-informacion-personal",
  typosquat: "https://www.incibe.es/aprendeciberseguridad/phishing",
  brandform: "https://www.incibe.es/ciudadania/tags/phishing",
  insecureform: "https://www.osi.es/es/protege-tu-wifi",
  crossform: "https://www.incibe.es/aprendeciberseguridad/phishing",
  exfil: "https://www.osi.es/es/tu-informacion-personal",
  skimmer: "https://www.incibe.es/aprendeciberseguridad/fraude-online",
  scam: "https://www.osi.es/es/campanias/fraudes-en-la-red",
  clickfix: "https://www.incibe.es/aprendeciberseguridad/ingenieria-social",
  iframes: "https://owasp.org/www-community/attacks/Clickjacking",
  permissions: "https://www.osi.es/es/tu-informacion-personal",
  locker: "https://www.incibe.es/aprendeciberseguridad/ingenieria-social",
  fingerprint: "https://www.osi.es/es/tu-informacion-personal",
  downloads: "https://www.incibe.es/aprendeciberseguridad/malware",
};

const INTL = {
  reputation: "https://safebrowsing.google.com/",
  community: "https://owasp.org/www-community/attacks/Phishing",
  redirects: "https://owasp.org/www-community/attacks/Unvalidated_Redirects_and_Forwards_Cheat_Sheet",
  tld: "https://owasp.org/www-community/attacks/Phishing",
  rawip: "https://owasp.org/www-community/attacks/Phishing",
  weirdport: "https://owasp.org/www-community/attacks/Phishing",
  domainage: "https://owasp.org/www-community/attacks/Phishing",
  mining: "https://owasp.org/www-community/attacks/Cryptojacking",
  thirdparties: "https://www.eff.org/issues/online-behavioral-tracking",
  trackerlearn: "https://www.eff.org/issues/online-behavioral-tracking",
  typosquat: "https://owasp.org/www-community/attacks/Phishing",
  brandform: "https://owasp.org/www-community/attacks/Phishing",
  insecureform: "https://developer.mozilla.org/docs/Web/Security/Transport_Layer_Security",
  crossform: "https://owasp.org/www-community/attacks/Phishing",
  exfil: "https://owasp.org/www-community/attacks/Data_Exfiltration",
  skimmer: "https://owasp.org/www-community/attacks/Web_Skimming",
  scam: "https://owasp.org/www-community/attacks/Phishing",
  clickfix: "https://attack.mitre.org/techniques/T1204/004/",
  iframes: "https://owasp.org/www-community/attacks/Clickjacking",
  permissions: "https://developer.mozilla.org/docs/Web/API/Permissions_API",
  locker: "https://owasp.org/www-community/attacks/Phishing",
  fingerprint: "https://coveryourtracks.eff.org/",
  downloads: "https://owasp.org/www-community/attacks/Malicious_File_Execution",
};

export function learnUrl(detectorKey) {
  const lang = (chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || "en";
  const table = /^(es|ca)/.test(lang) ? ES : INTL;
  return table[detectorKey] || INTL[detectorKey] || null;
}
