// Independent sanity check of the built maps — the files the game actually renders.
//
// Two questions, answered without trusting the build pipeline:
//   1. Do real-world coordinates land in the polygon they should?
//      (Invented or mismatched geometry fails this immediately.)
//   2. Do the polygon areas agree with published figures?
//
// Reference coordinates and areas below are well-known published values, written
// out by hand so they are not derived from the same sources as the maps.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { geoArea } from 'd3-geo'
import { feature } from 'topojson-client'
import { contains, distanceToKm } from './lib/point-in-polygon.mjs'

const DATA = resolve(import.meta.dirname, '../public/data')
const CACHE = resolve(import.meta.dirname, '../.data-cache')

/** [name of the place, lon, lat, region it must fall inside] */
const PROBES = {
  'world-countries': [
    ['Париж', 2.3522, 48.8566, 'Франция'],
    ['Осло', 10.7522, 59.9139, 'Норвегия'],
    ['Токио', 139.6917, 35.6895, 'Япония'],
    ['Каир', 31.2357, 30.0444, 'Египет'],
    ['Буэнос-Айрес', -58.3816, -34.6037, 'Аргентина'],
    ['Сидней', 151.2093, -33.8688, 'Австралия'],
    ['Найроби', 36.8219, -1.2921, 'Кения'],
    ['Оттава', -75.6972, 45.4215, 'Канада'],
    ['Дели', 77.209, 28.6139, 'Индия'],
    ['Бразилиа', -47.8825, -15.7942, 'Бразилия'],
    ['Рейкьявик', -21.8277, 64.1265, 'Исландия'],
    ['Веллингтон', 174.7762, -41.2865, 'Новая Зеландия'],
  ],
  'slovenia-municipalities': [
    ['Любляна', 14.5058, 46.0569, 'Любляна'],
    ['Марибор', 15.6467, 46.5547, 'Марибор'],
    ['Копер', 13.73, 45.5481, 'Копер'],
    ['Пиран', 13.5683, 45.5283, 'Пиран'],
    ['Блед', 14.1136, 46.3683, 'Блед'],
    ['Ново-Место', 15.17, 45.8033, 'Ново-Место'],
    ['Мурска-Собота', 16.1667, 46.6583, 'Мурска-Собота'],
    ['Целе', 15.2675, 46.2309, 'Целе'],
  ],
  'timor-municipalities': [
    ['Дили', 125.5736, -8.5569, 'Дили'],
    ['Баукау', 126.4513, -8.4711, 'Баукау'],
    ['Пантемакассар', 124.3775, -9.2025, 'Окуси-Амбено'],
  ],
  'myanmar-states': [
    ['Янгон', 96.1951, 16.8661, 'Янгон'],
    ['Мандалай', 96.0891, 21.9588, 'Мандалай'],
    ['Ситуэ', 92.9, 20.15, 'Ракхайн'],
    ['Мьичина', 97.3964, 25.3833, 'Качин'],
  ],
  'niger-regions': [
    ['Ниамей', 2.1098, 13.5117, 'Ниамей'],
    ['Агадес', 7.9861, 16.9742, 'Агадес'],
    ['Зиндер', 8.9881, 13.8072, 'Зиндер'],
    ['Маради', 7.1017, 13.5, 'Маради'],
  ],
  'mali-regions': [
    ['Бамако', -8.0029, 12.6392, 'Бамако'],
    ['Томбукту', -3.0074, 16.7735, 'Томбукту'],
    ['Гао', -0.0442, 16.2667, 'Гао'],
    ['Сикасо', -5.6667, 11.3167, 'Сикасо'],
  ],
  'chad-provinces': [
    ['Нджамена', 15.0444, 12.1067, 'Нджамена'],
    ['Абеше', 20.8324, 13.8292, 'Ваддай'],
    ['Фая-Ларжо', 19.1, 17.9167, 'Борку'],
    ['Мунду', 16.0833, 8.5667, 'Западный Логон'],
  ],
  'car-prefectures': [
    ['Банги', 18.5582, 4.3947, 'Банги'],
    ['Бамбари', 20.6667, 5.7667, 'Уака'],
    ['Бирао', 22.7833, 10.2833, 'Вакага'],
  ],
  'south-sudan-states': [
    ['Джуба', 31.5825, 4.8594, 'Центральная Экваториальная провинция'],
    ['Малакаль', 31.6605, 9.5334, 'Верхний Нил'],
    ['Вау', 27.995, 7.7, 'Западный Бахр-эль-Газаль'],
  ],
}

const EARTH_KM2 = 6371 ** 2

async function load(id) {
  const topo = JSON.parse(await readFile(resolve(DATA, `${id}.json`), 'utf8'))
  return feature(topo, topo.objects.regions).features
}

const sets = new Map()
for (const id of Object.keys(PROBES)) sets.set(id, await load(id))

let hits = 0
let total = 0
const misses = []

console.log('Попадание реальных координат в полигоны (файлы из public/data):\n')
for (const [id, probes] of Object.entries(PROBES)) {
  const features = sets.get(id)
  let ok = 0
  for (const [place, lon, lat, expected] of probes) {
    total++
    const found = features.find((f) => contains(f.geometry, [lon, lat]))
    const name = found?.properties.name ?? '—'
    if (name === expected) {
      ok++
      hits++
    } else {
      // Quantify the miss: a coastal town can sit just outside a smoothed
      // coastline, which is a very different failure from wrong geometry.
      const target = features.find((f) => f.properties.name === expected)
      const km = target ? distanceToKm(target.geometry, [lon, lat]) : Infinity
      misses.push(
        `${id}: ${place} → «${name}», ожидалось «${expected}»` +
          (target ? ` (до контура «${expected}» ${km.toFixed(1)} км)` : ''),
      )
    }
  }
  console.log(`  ${id.padEnd(26)} ${ok}/${probes.length}`)
}

// --- areas against Wikidata, which had no hand in building these files ---
const areaRows = JSON.parse(await readFile(resolve(CACHE, 'wikidata_areas.json'), 'utf8'))
  .results.bindings
const SQUARE_KM = 'http://www.wikidata.org/entity/Q712226'
// Matching is by ISO code only. Names collide across levels — Wikidata has both
// the Agadez region (667 799 km²) and the Agadez commune (1 001 km²) as "Агадес",
// and a name-based match silently picked the wrong one.
const publishedByIso = new Map()
for (const row of areaRows) {
  if (row.unit.value !== SQUARE_KM) continue // a couple of entries are in m²
  const km2 = Number(row.area.value)
  for (const iso of [row.iso3?.value, row.iso2?.value]) {
    if (iso && !publishedByIso.has(iso)) publishedByIso.set(iso, km2)
  }
}

console.log('\nПлощадь отрисовываемых полигонов против опубликованной (Wikidata):\n')
const deviations = []
for (const [id, features] of sets) {
  const rows = []
  for (const f of features) {
    const published = publishedByIso.get(f.properties.id)
    if (!published) continue
    const km2 = geoArea(f) * EARTH_KM2
    rows.push({ name: f.properties.name, km2, published, error: (100 * (km2 - published)) / published })
  }
  if (!rows.length) {
    console.log(`  ${id.padEnd(26)} нет кодов ISO для сверки`)
    continue
  }
  const errors = rows.map((r) => Math.abs(r.error)).sort((a, b) => a - b)
  const median = errors[Math.floor(errors.length / 2)]
  const within5 = errors.filter((e) => e <= 5).length
  console.log(
    `  ${id.padEnd(26)} сверено ${String(rows.length).padStart(3)}   ` +
      `медиана |откл| ${median.toFixed(1)}%   в пределах 5%: ${within5}/${rows.length}`,
  )
  deviations.push(...rows.map((r) => ({ ...r, id })))
}

const worst = deviations.sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 6)
console.log('\n  Наибольшие расхождения (смотреть вручную):')
for (const r of worst) {
  console.log(
    `    ${r.name.padEnd(26)} ${Math.round(r.km2).toLocaleString('ru').padStart(11)} км²  ` +
      `опубликовано ${Math.round(r.published).toLocaleString('ru').padStart(11)}  ` +
      `${r.error >= 0 ? '+' : ''}${r.error.toFixed(1)}%`,
  )
}

const allErrors = deviations.map((d) => Math.abs(d.error)).sort((a, b) => a - b)
const medianAll = allErrors[Math.floor(allErrors.length / 2)]

console.log(
  `\nИтог: координаты ${hits}/${total}; площадь сверена по ${deviations.length} полигонам, ` +
    `медиана расхождения ${medianAll.toFixed(1)}%`,
)
for (const miss of misses) console.log('  ⚠ ' + miss)
process.exitCode = misses.length ? 1 : 0
