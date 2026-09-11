/** Loose key for matching the same place across Natural Earth / geoBoundaries / Wikidata. */
export function nameKey(raw) {
  if (!raw) return ''
  return String(raw)
    .split('/')[0] // "Koper / Capodistria" -> "Koper"
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\b(municipality|community|region|province|prefecture|state|district|obcina)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}
