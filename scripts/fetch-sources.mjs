// Downloads and caches every raw geodata/label source used by build-maps.mjs.
// Cache lives in .data-cache/ and is gitignored — safe to delete and re-run.
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const CACHE = resolve(import.meta.dirname, '../.data-cache')
const UA = 'studyge-dev/0.1 (https://github.com/; contact: chernyshenko.eugene@gmail.com)'

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'

/** @type {{file: string, url: string}[]} */
const DOWNLOADS = [
  { file: 'ne_10m_admin_1.geojson', url: `${NE}/ne_10m_admin_1_states_provinces.geojson` },
  { file: 'ne_10m_admin_0.geojson', url: `${NE}/ne_10m_admin_0_countries.geojson` },
  { file: 'ne_10m_places.geojson', url: `${NE}/ne_10m_populated_places.geojson` },
  { file: 'ne_10m_land.geojson', url: `${NE}/ne_10m_land.geojson` },
]

// Countries where Natural Earth's admin-1 set is incomplete or outdated.
const GEOBOUNDARIES = [
  { file: 'gb_SVN_ADM2.geojson', iso: 'SVN', level: 'ADM2' }, // 213 občine vs NE's 193
  { file: 'gb_TCD_ADM1.geojson', iso: 'TCD', level: 'ADM1' }, // 23 provinces vs NE's 22
]

// Russian labels: P150 = "contains administrative territorial entity".
const WIKIDATA_COUNTRIES = [
  'Q215', // Словения
  'Q574', // Восточный Тимор
  'Q836', // Мьянма
  'Q1032', // Нигер
  'Q912', // Мали
  'Q657', // Чад
  'Q929', // ЦАР
  'Q958', // Южный Судан
  'Q159', // Россия
  'Q212', // Украина — четыре области входят в набор субъектов
  'Q184', // Беларусь
  'Q30', // США
]
const SPARQL = `SELECT ?c ?cEn ?item ?ru ?en ?native ?iso ?coord ?end WHERE {
  VALUES ?c { ${WIKIDATA_COUNTRIES.map((q) => `wd:${q}`).join(' ')} }
  ?c wdt:P150 ?item .
  ?c rdfs:label ?cEn FILTER(lang(?cEn)="en")
  OPTIONAL { ?item wdt:P300 ?iso }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item p:P31/pq:P582 ?end }
  OPTIONAL { ?item rdfs:label ?ru FILTER(lang(?ru)="ru") }
  OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") }
  OPTIONAL { ?item skos:altLabel ?native FILTER(lang(?native)="sl") }
}`

// Published areas, used only by scripts/verify-geometry.mjs to check the built
// maps against a source that had no part in building them. Split in two: asking
// for countries and subdivisions at once times the public endpoint out.
const COUNTRY_AREA_SPARQL = `SELECT ?item ?iso3 ?area ?unit ?rank WHERE {
  ?item wdt:P298 ?iso3 ; wdt:P31 wd:Q3624078 .
  ?item p:P2046 ?st .
  ?st psv:P2046 ?v ; wikibase:rank ?rank .
  ?v wikibase:quantityAmount ?area ; wikibase:quantityUnit ?unit .
}`

const SUBDIVISION_AREA_SPARQL = `SELECT ?item ?iso2 ?area ?unit ?rank WHERE {
  VALUES ?c { ${WIKIDATA_COUNTRIES.map((q) => `wd:${q}`).join(' ')} }
  ?c wdt:P150 ?item .
  ?item wdt:P300 ?iso2 .
  ?item p:P2046 ?st .
  ?st psv:P2046 ?v ; wikibase:rank ?rank .
  ?v wikibase:quantityAmount ?area ; wikibase:quantityUnit ?unit .
}`

// Administrative seats: which town is the centre of each unit, and where it is.
const SEAT_SPARQL = `SELECT ?item ?iso ?seatRu ?seatEn ?coord WHERE {
  VALUES ?c { ${WIKIDATA_COUNTRIES.map((q) => `wd:${q}`).join(' ')} }
  ?c wdt:P150 ?item .
  ?item wdt:P300 ?iso .
  ?item wdt:P36 ?seat .
  ?seat wdt:P625 ?coord .
  OPTIONAL { ?seat rdfs:label ?seatRu FILTER(lang(?seatRu)="ru") }
  OPTIONAL { ?seat rdfs:label ?seatEn FILTER(lang(?seatEn)="en") }
}`

async function exists(path) {
  try {
    const s = await stat(path)
    return s.size > 0
  } catch {
    return false
  }
}

async function download(url, file) {
  const path = resolve(CACHE, file)
  if (await exists(path)) {
    console.log(`  cached  ${file}`)
    return path
  }
  console.log(`  fetch   ${file}`)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  await writeFile(path, Buffer.from(await res.arrayBuffer()))
  return path
}

async function geoBoundaries({ file, iso, level }) {
  const path = resolve(CACHE, file)
  if (await exists(path)) {
    console.log(`  cached  ${file}`)
    return
  }
  const meta = await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso}/${level}/`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.json())
  const entry = Array.isArray(meta) ? meta[0] : meta
  await download(entry.gjDownloadURL, file)
}

async function wikidata(file, query) {
  const path = resolve(CACHE, file)
  if (await exists(path)) {
    console.log(`  cached  ${file}`)
    return
  }
  console.log(`  fetch   ${file}`)
  // The public endpoint returns 502/504 under load often enough that a single
  // attempt makes `npm run data` flaky; back off and try again.
  let lastStatus = 0
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
    })
    if (res.ok) {
      await writeFile(path, await res.text())
      return
    }
    lastStatus = res.status
    if (attempt < 4) {
      const wait = attempt * 15_000
      console.log(`          HTTP ${res.status}, повтор через ${wait / 1000} с`)
      await new Promise((done) => setTimeout(done, wait))
    }
  }
  throw new Error(`wikidata ${file} -> HTTP ${lastStatus} после 4 попыток`)
}

await mkdir(CACHE, { recursive: true })
console.log('sources:')
for (const d of DOWNLOADS) await download(d.url, d.file)
for (const g of GEOBOUNDARIES) await geoBoundaries(g)
await wikidata('wikidata_admin_ru.json', SPARQL)
await wikidata('wikidata_areas_countries.json', COUNTRY_AREA_SPARQL)
await wikidata('wikidata_areas_subdivisions.json', SUBDIVISION_AREA_SPARQL)
await wikidata('wikidata_seats.json', SEAT_SPARQL)
console.log('done')
