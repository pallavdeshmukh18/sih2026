export function flattenStrings(value, prefix = '', output = {}) {
  for (const [key, child] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') output[path] = child;
    else if (child && typeof child === 'object') flattenStrings(child, path, output);
  }
  return output;
}
const normalize = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim();

// Use the site's authored translations, never guess medical meanings.
export function createSiteTextResolver(resources) {
  const english = flattenStrings(resources.en.translation);
  const indices = new Map();
  return (text, language = 'en') => {
    const input = normalize(String(text || ''));
    const locale = language.split('-')[0];
    if (locale === 'en' || !resources[locale]) return input;
    if (!indices.has(locale)) {
      const exact = new Map();
      for (const [key, translated] of Object.entries(flattenStrings(resources[locale].translation))) {
        if (!english[key] || translated.includes('{{')) continue;
        const label = normalize(translated);
        if (exact.has(label) && exact.get(label) !== english[key]) exact.set(label, null);
        else if (!exact.has(label)) exact.set(label, english[key]);
      }
      indices.set(locale, exact);
    }
    return indices.get(locale).get(input) || input;
  };
}

export function accessibleSignText(element) {
  if (!element || element.closest('[data-isl-ignore], [data-testid="isl-avatar-card"], [aria-hidden="true"], [hidden], script, style')) return '';
  if (element.matches('input[type="password"], input[type="hidden"]')) return '';
  for (const attribute of ['data-sign-text', 'data-acc-text', 'aria-label', 'alt', 'title']) {
    const value = element.getAttribute(attribute);
    if (value?.trim()) return value.trim();
  }
  if (element.matches('input, textarea, select')) {
    return element.labels?.[0]?.textContent?.trim() || element.getAttribute('placeholder') || '';
  }
  return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
}
