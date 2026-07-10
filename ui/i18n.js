// Ayudas de internacionalización para las páginas de la extensión (B5).
// Los textos viven en _locales/<idioma>/messages.json; Chrome elige el idioma
// del navegador y cae al default_locale (es) si no hay traducción.

export const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

// Traduce el HTML estático: elementos con data-i18n (texto), data-i18n-title
// (atributo title) y data-i18n-placeholder (atributo placeholder).
export function localizePage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
