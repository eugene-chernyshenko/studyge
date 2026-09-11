// Turns the cached raw sources into the TopoJSON files the game loads at runtime.
// Run `node scripts/fetch-sources.mjs` first. Output: public/data/*.json
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import mapshaper from 'mapshaper'
import { geoCentroid, geoArea, geoBounds } from 'd3-geo'
import { feature } from 'topojson-client'
import { SETS } from './sets.mjs'
import { nameKey } from './lib/normalize.mjs'
import { contains, planarArea } from './lib/point-in-polygon.mjs'

/** Published area in km² per ISO code — a second opinion on every assignment. */
const SQUARE_KM = 'http://www.wikidata.org/entity/Q712226'
const DEPRECATED = 'http://wikiba.se/ontology#DeprecatedRank'

const CACHE = resolve(import.meta.dirname, '../.data-cache')
const OUT = resolve(import.meta.dirname, '../public/data')
const OVERRIDES = resolve(import.meta.dirname, 'ru-overrides.json')

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))

const [admin1, admin0, places, nuts3, wikidata, areasRaw, seatsRaw, nutsRuRaw, nutsSeatsRaw, overrides] =
  await Promise.all([
  readJson(resolve(CACHE, 'ne_10m_admin_1.geojson')),
  readJson(resolve(CACHE, 'ne_10m_admin_0.geojson')),
  readJson(resolve(CACHE, 'ne_10m_places.geojson')),
  readJson(resolve(CACHE, 'nuts3.geojson')),
  readJson(resolve(CACHE, 'wikidata_admin_ru.json')),
  readJson(resolve(CACHE, 'wikidata_areas_subdivisions.json')),
  readJson(resolve(CACHE, 'wikidata_seats.json')),
  readJson(resolve(CACHE, 'wikidata_nuts_ru.json')),
  readJson(resolve(CACHE, 'wikidata_nuts_seats.json')),
  existsSync(OVERRIDES) ? readJson(OVERRIDES) : {},
])

// ---- Russian-name lookup, best source first -------------------------------
// Natural Earth ships name_ru for every admin-1 unit it knows; Wikidata fills the
// gaps for units that only exist in geoBoundaries.
const ruByKey = new Map()
const remember = (key, ru) => {
  if (key && ru && !ruByKey.has(key)) ruByKey.set(key, ru)
}
for (const f of admin1.features) remember(nameKey(f.properties.name), f.properties.name_ru)

// Wikidata, indexed three ways: by loose name, by ISO 3166-2 code, and by point
// (geoBoundaries' Slovenian names are mojibake and it carries no ISO codes, so
// the only reliable link there is "which polygon contains the town").
const ruByIso = new Map()
const ruPoints = []
for (const row of wikidata.results.bindings) {
  if (row.end) continue // skip abolished divisions
  // Keep entries with no Russian label: scripts/ru-overrides.json supplies those,
  // and dropping them here would leave their polygon unmatched entirely.
  const ru = row.ru?.value ?? null
  const en = row.en?.value ?? null
  remember(nameKey(en), ru)
  remember(nameKey(row.native?.value), ru)
  const iso = row.iso?.value
  if (iso && !ruByIso.has(iso)) ruByIso.set(iso, { ru, en, iso })
  if (!ru && !iso) continue
  const m = row.coord?.value?.match(/Point\(([-\d.]+) ([-\d.]+)\)/)
  if (m) ruPoints.push({ ru, en, iso: iso ?? null, at: [Number(m[1]), Number(m[2])] })
}

// NE's country file calls South Sudan SDS while its places file uses SSD.
const ADM0_ALIASES = { SDS: 'SSD' }
// Nauru has no official capital; Yaren is the seat of government and is what quizzes expect.
const CAPITAL_FALLBACKS = { NRU: 'Ярен' }

const areaByIso = (() => {
  const values = new Map()
  for (const row of areasRaw.results.bindings) {
    if (row.unit.value !== SQUARE_KM || row.rank?.value === DEPRECATED) continue
    const iso = row.iso2?.value
    if (!iso) continue
    if (!values.has(iso)) values.set(iso, [])
    values.get(iso).push(Number(row.area.value))
  }
  return new Map(
    [...values].map(([iso, list]) => {
      const sorted = list.sort((a, b) => a - b)
      return [iso, sorted[Math.floor(sorted.length / 2)]]
    }),
  )
})()

/** Rough km² for a lon/lat polygon — enough to tell 49 km² from 153 km². */
function approxKm2(geometry, lat) {
  return planarArea(geometry) * 110.574 * 111.32 * Math.cos((lat * Math.PI) / 180)
}

// --- administrative seats ------------------------------------------------
// Two sources, because neither covers everything: Wikidata knows the seat of
// 21 of Chad's 23 provinces but only 59 of Slovenia's 212 municipalities, while
// Natural Earth has town points but mislabels which unit they belong to (it files
// Niger's Tillabéri under Niamey). So NE points are attached by geometry instead.
const POINT = /Point\(([-\d.]+) ([-\d.]+)\)/

// Keyed by whatever code identifies the unit — ISO 3166-2 or NUTS; the two
// code spaces do not collide, so one lookup serves both kinds of set.
const seatByIso = new Map()
for (const [rows, key] of [
  [seatsRaw.results.bindings, 'iso'],
  [nutsSeatsRaw.results.bindings, 'nuts'],
]) {
  for (const row of rows) {
    const m = row.coord?.value?.match(POINT)
    const code = row[key]?.value
    if (!m || !code || seatByIso.has(code)) continue
    seatByIso.set(code, {
      name: row.seatRu?.value ?? row.seatEn?.value ?? null,
      at: [Number(m[1]), Number(m[2])],
    })
  }
}

/** Town points that can stand in for a missing seat, with their coordinates. */
const townPoints = places.features
  .filter((f) => ['Admin-1 capital', 'Admin-0 capital'].includes(f.properties.FEATURECLA))
  .map((f) => ({
    name: f.properties.NAME_RU || f.properties.NAME,
    at: f.geometry.coordinates,
  }))

/** Attach a seat to each feature: by ISO code first, then by which town falls inside. */
function withSeats(features) {
  return features.map((f) => {
    const fromIso = seatByIso.get(f.properties.id)
    const seat = fromIso ?? townPoints.find((t) => contains(f.geometry, t.at)) ?? null
    if (!seat?.name) return f
    return { ...f, properties: { ...f.properties, seat: seat.name, seatAt: seat.at.map((n) => Math.round(n * 1000) / 1000) } }
  })
}

const capitalByIso = new Map()
for (const f of places.features) {
  const p = f.properties
  if (p.FEATURECLA === 'Admin-0 capital' && p.ADM0_A3) {
    capitalByIso.set(p.ADM0_A3, { ru: p.NAME_RU || p.NAME, en: p.NAME, at: f.geometry.coordinates })
  }
}

// ---- Per-source region extraction -----------------------------------------
// Natural Earth uses a few non-standard ISO_A2 values that have no flag file.
const ISO2_ALIASES = { 'cn-tw': 'tw' }

/** NE leaves ISO_A2 as "-99" for France, Norway and others; ISO_A2_EH has the real code. */
function iso2Of(p) {
  const raw = [p.ISO_A2_EH, p.ISO_A2].find((code) => code && code !== '-99')
  if (!raw) return null
  const lower = raw.toLowerCase()
  return ISO2_ALIASES[lower] ?? lower
}

function fromAdmin0() {
  return admin0.features
    .filter((f) => {
      const p = f.properties
      return (
        (p.TYPE === 'Sovereign country' || p.TYPE === 'Country') &&
        // Dependencies (Greenland, Åland, Hong Kong…) carry a different sovereign.
        p.ADMIN === p.SOVEREIGNT &&
        iso2Of(p) !== null &&
        p.NAME_RU
      )
    })
    .map((f) => {
      const p = f.properties
      const cap = capitalByIso.get(ADM0_ALIASES[p.ADM0_A3] ?? p.ADM0_A3)
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: p.ADM0_A3,
          name: p.NAME_RU,
          nameEn: p.NAME_EN || p.NAME,
          iso2: iso2Of(p),
          capital: cap?.ru ?? CAPITAL_FALLBACKS[p.ADM0_A3] ?? null,
          capitalAt: cap ? cap.at.map((n) => Math.round(n * 1000) / 1000) : null,
        },
      }
    })
}

const nutsRu = new Map(
  nutsRuRaw.results.bindings.map((row) => [
    row.nuts.value,
    { ru: row.ru?.value ?? null, en: row.en?.value ?? null },
  ]),
)

/** Eurostat NUTS regions for one country, keyed by their NUTS code. */
function fromNuts(country) {
  return nuts3.features
    .filter((f) => f.properties.CNTR_CODE === country)
    .map((f) => {
      const p = f.properties
      const known = nutsRu.get(p.NUTS_ID)
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: p.NUTS_ID,
          name: overrides[p.NUTS_ID] || known?.ru || p.NAME_LATN,
          nameEn: p.NAME_LATN,
        },
      }
    })
}

function fromAdmin1(adm0, { include = [], exclude = [] } = {}) {
  const isoOf = (p) => (p.iso_3166_2 && p.iso_3166_2 !== '-99' ? p.iso_3166_2 : null)
  return admin1.features
    .filter((f) => {
      const iso = isoOf(f.properties)
      if (iso && exclude.includes(iso)) return false
      return f.properties.adm0_a3 === adm0 || (iso && include.includes(iso))
    })
    .map((f) => {
      const p = f.properties
      // Prefer the ISO 3166-2 code as the id: it is stable and lets external
      // sources (scripts/verify-geometry.mjs) be matched without guessing names.
      const iso = p.iso_3166_2 && p.iso_3166_2 !== '-99' ? p.iso_3166_2 : null
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: iso ?? p.adm1_code,
          // Overrides come first: Natural Earth's name_ru is wrong in places
          // (it labels Altai Krai "Республика Алтай", the neighbouring republic).
          name: overrides[iso] || overrides[nameKey(p.name)] || p.name_ru || p.name,
          nameEn: p.name,
        },
      }
    })
}

async function fromGeoBoundaries(file, isoPrefix) {
  const gj = await readJson(resolve(CACHE, file))

  // geoBoundaries ships a few zero-area slivers alongside the real units.
  // (Its rings wind the wrong way, so d3's spherical geoArea reports ~4π here —
  // the planar shoelace area is what actually separates slivers from units.)
  const features = gj.features.filter((f) => planarArea(f.geometry) > 1e-4)
  const dropped = gj.features.length - features.length

  const centroids = features.map((f) => geoCentroid(f))

  // Match each unit's Wikidata coordinate to the polygon that contains it.
  // Strictly phased: undisputed containment wins first, so a point that merely
  // happens to be near a polygon can never take one that another point sits inside.
  const pool = []
  const seen = new Set()
  for (const cand of ruPoints) {
    if (!cand.iso?.startsWith(isoPrefix) || seen.has(cand.iso)) continue
    seen.add(cand.iso)
    pool.push({ ...cand, hits: features.flatMap((f, i) => (contains(f.geometry, cand.at) ? [i] : [])) })
  }

  const assigned = new Map() // feature index -> wikidata record
  // Phase 1 — exactly one polygon contains this point, and nothing claims it yet.
  for (const c of pool) {
    if (c.hits.length === 1 && !assigned.has(c.hits[0])) assigned.set(c.hits[0], c)
  }
  // Phase 2 — contested or overlapping: take a still-free polygon that contains it.
  for (const c of pool) {
    if (assignedTo(assigned, c)) continue
    const free = c.hits.find((i) => !assigned.has(i))
    if (free !== undefined) assigned.set(free, c)
  }
  // Phase 3 — the coordinate missed every polygon, usually a Wikidata point
  // rounded to two decimals that landed just over a border. Assign what is left
  // by distance, but globally: take the closest pair overall, then the next, and
  // so on. Assigning in arrival order swapped Žiri with Gorenja vas–Poljane,
  // because Gorenja vas' rounded point sits nearer Žiri's polygon than its own.
  const leftovers = pool.filter((c) => !assignedTo(assigned, c))
  const free = () => features.map((_, i) => i).filter((i) => !assigned.has(i))
  const pairs = leftovers
    .flatMap((c) => free().map((i) => ({ c, i, d: dist2(centroids[i], c.at) })))
    .sort((a, b) => a.d - b.d)
  for (const pair of pairs) {
    if (assigned.has(pair.i) || assignedTo(assigned, pair.c)) continue
    assigned.set(pair.i, pair.c)
  }

  // Then let any two of those settle their dispute if swapping brings both closer.
  const byDistance = [...assigned].filter(([, c]) => leftovers.includes(c))
  for (let pass = 0; pass < byDistance.length; pass++) {
    let improved = false
    for (const [i, ci] of byDistance) {
      for (const [j, cj] of byDistance) {
        if (i === j) continue
        const now = dist2(centroids[i], ci.at) + dist2(centroids[j], cj.at)
        const swapped = dist2(centroids[i], cj.at) + dist2(centroids[j], ci.at)
        if (swapped < now - 1e-12) {
          assigned.set(i, cj)
          assigned.set(j, ci)
          improved = true
        }
      }
    }
    if (!improved) break
  }

  // A rounded Wikidata coordinate can sit inside the *neighbouring* unit, which
  // no amount of distance reasoning can detect — it looks like a clean hit. The
  // published area is an independent signal. It is a weak one on its own (plenty
  // of municipalities are the same size), so a swap is only allowed between
  // neighbours, must improve the size fit a lot, and must not make the distances
  // meaningfully worse.
  const NEIGHBOUR = 0.3 ** 2 // squared degrees between centroids
  const SIZE_GAIN = 0.5 // natural-log units of area ratio
  const DISTANCE_SLACK = 0.05 // squared degrees the pair may lose in distance

  const sizeMiss = (i, c) => {
    const published = areaByIso.get(c.iso)
    if (!published) return 0
    const km2 = approxKm2(features[i].geometry, centroids[i][1])
    return km2 > 0 ? Math.abs(Math.log(km2 / published)) : 0
  }

  for (let pass = 0; pass < 4; pass++) {
    let improved = false
    const entries = [...assigned]
    for (const [i, ci] of entries) {
      for (const [j, cj] of entries) {
        if (i >= j) continue
        if (dist2(centroids[i], centroids[j]) > NEIGHBOUR) continue
        const sizeNow = sizeMiss(i, ci) + sizeMiss(j, cj)
        const sizeSwapped = sizeMiss(i, cj) + sizeMiss(j, ci)
        if (sizeSwapped > sizeNow - SIZE_GAIN) continue
        const distNow = dist2(centroids[i], ci.at) + dist2(centroids[j], cj.at)
        const distSwapped = dist2(centroids[i], cj.at) + dist2(centroids[j], ci.at)
        if (distSwapped > distNow + DISTANCE_SLACK) continue
        console.log(
          `  ↔ ${file}: ${ci.iso} ↔ ${cj.iso} переставлены — площади расходились ` +
            `в ${Math.exp(sizeNow - sizeSwapped).toFixed(1)} раза`,
        )
        assigned.set(i, cj)
        assigned.set(j, ci)
        improved = true
      }
    }
    if (!improved) break
  }

  const FAR = 0.5 // degrees
  for (const [i, c] of assigned) {
    if (!leftovers.includes(c)) continue
    if (dist2(centroids[i], c.at) > FAR ** 2) {
      console.log(`  ⚠ ${file}: ${c.iso} (${c.en ?? c.ru}) — сопоставление по близости, проверьте вручную`)
    }
  }

  if (dropped) console.log(`  (${file}: отброшено ${dropped} вырожденных полигонов)`)

  return features.map((f, i) => {
    const p = f.properties
    const rawIso = p.shapeISO && p.shapeISO !== 'None' && p.shapeISO !== '' ? p.shapeISO : null
    // An ISO code straight from the source beats anything inferred.
    const hit = (rawIso && ruByIso.get(rawIso)) || assigned.get(i) || null
    const id = rawIso ?? hit?.iso ?? p.shapeID
    const key = nameKey(p.shapeName)
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id,
        name: overrides[id] || overrides[key] || hit?.ru || ruByKey.get(key) || p.shapeName,
        nameEn: hit?.en ?? p.shapeName,
      },
    }
  })
}

const dist2 = ([ax, ay], [bx, by]) => (ax - bx) ** 2 + (ay - by) ** 2

const assignedTo = (assigned, cand) => [...assigned.values()].includes(cand)

// ---- Build ----------------------------------------------------------------
await mkdir(OUT, { recursive: true })
const manifest = []
const untranslated = []

for (const set of SETS) {
  const features =
    set.source.kind === 'ne-admin0'
      ? fromAdmin0()
      : set.source.kind === 'ne-admin1'
        ? fromAdmin1(set.source.adm0, set.source)
        : set.source.kind === 'nuts'
        ? fromNuts(set.source.country)
        : await fromGeoBoundaries(set.source.file, set.source.isoPrefix)

  if (!features.length) throw new Error(`${set.id}: no features matched`)
  const withCentres = set.source.kind === 'ne-admin0' ? features : withSeats(features)
  const seatCount = withCentres.filter((f) => f.properties.seat).length

  const input = JSON.stringify({ type: 'FeatureCollection', features: withCentres })
  const files = { 'in.json': input }
  const cmd = ['-i in.json']
  if (set.clipToLand) {
    files['land.json'] = await readFile(resolve(CACHE, 'ne_10m_land.geojson'), 'utf8')
    cmd.push('-clip land.json')
  }
  cmd.push(`-simplify ${set.simplify} keep-shapes weighted`, '-clean', '-o out.json format=topojson id-field=id')
  const result = await mapshaper.applyCommands(cmd.join(' '), files)
  const topo = JSON.parse(Buffer.from(result['out.json']).toString('utf8'))

  // mapshaper names the output object after the input file; normalise it.
  const objectName = Object.keys(topo.objects)[0]
  topo.objects = { regions: topo.objects[objectName] }

  // Centroids drive the "where you clicked" marker and the zoom-to-answer camera.
  const collection = feature(topo, topo.objects.regions)
  const byId = new Map(collection.features.map((f) => [f.properties.id, f]))
  for (const geom of topo.objects.regions.geometries) {
    const f = byId.get(geom.properties.id)
    if (!f) continue
    geom.properties.c = geoCentroid(f).map((n) => Math.round(n * 1000) / 1000)
    geom.properties.a = Number(geoArea(f).toExponential(3)) // steradians, for difficulty ordering
  }

  const file = `${set.id}.json`
  await writeFile(resolve(OUT, file), JSON.stringify(topo))

  const [[w, s], [e, n]] = geoBounds(collection)
  const missing = collection.features.filter((f) => !/[А-Яа-яЁё]/.test(f.properties.name))
  if (missing.length) {
    untranslated.push(...missing.map((f) => `${set.id}: ${f.properties.name}`))
  }

  manifest.push({
    id: set.id,
    title: set.title,
    group: set.group,
    country: set.country ?? null,
    unit: set.unit,
    count: collection.features.length,
    modes: set.modes,
    projection: set.projection,
    ...(set.rotate ? { rotate: set.rotate } : {}),
    ...(set.parallels ? { parallels: set.parallels } : {}),
    bbox: [w, s, e, n].map((x) => Math.round(x * 100) / 100),
    file: `data/${file}`,
    attribution: set.attribution,
  })

  const kb = Math.round(JSON.stringify(topo).length / 1024)
  const centres =
    set.source.kind === 'ne-admin0'
      ? collection.features.filter((f) => f.properties.capitalAt).length
      : seatCount
  console.log(
    `${set.id.padEnd(26)} ${String(collection.features.length).padStart(4)} регионов  ${String(kb).padStart(5)} KB` +
      `  центров ${String(centres).padStart(3)}/${collection.features.length}` +
      (missing.length ? `  ⚠ ${missing.length} без рус. названия` : ''),
  )
}

await writeFile(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

if (untranslated.length) {
  console.log(`\nБез русского названия (${untranslated.length}) — добавьте в scripts/ru-overrides.json:`)
  for (const u of untranslated) console.log('  ' + u)
}
