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
  'russia-subjects': [
    ['Москва', 37.6173, 55.7558, 'Москва'],
    ['Санкт-Петербург', 30.3351, 59.9343, 'Санкт-Петербург'],
    ['Новосибирск', 82.9346, 55.0084, 'Новосибирская область'],
    ['Владивосток', 131.8869, 43.1155, 'Приморский край'],
    ['Казань', 49.1064, 55.7963, 'Татарстан'],
    ['Калининград', 20.5106, 54.7104, 'Калининградская область'],
    // Anadyr sits past 180°, which is exactly what the rotated projection is for.
    ['Анадырь', 177.5083, 64.7314, 'Чукотский автономный округ'],
    ['Мурманск', 33.0856, 68.9585, 'Мурманская область'],
    ['Барнаул', 83.7636, 53.3548, 'Алтайский край'],
    ['Горно-Алтайск', 85.9601, 51.9582, 'Республика Алтай'],
    ['Симферополь', 34.1024, 44.9521, 'Республика Крым'],
    ['Донецк', 37.8028, 48.0159, 'Донецкая область'],
  ],
  'ukraine-oblasts': [
    ['Львов', 24.0297, 49.8397, 'Львовская область'],
    ['Одесса', 30.7233, 46.4825, 'Одесская область'],
    ['Харьков', 36.2304, 49.9935, 'Харьковская область'],
    ['Ужгород', 22.2879, 48.6208, 'Закарпатская область'],
    ['Чернигов', 31.2893, 51.4982, 'Черниговская область'],
    ['Днепр', 35.0456, 48.4647, 'Днепропетровская область'],
    // Kyiv the city is an enclave inside Kyiv oblast: a probe that catches the
    // oblast instead means the enclave has no hole punched in it.
    ['Киев', 30.5234, 50.4501, 'Киев'],
  ],
  'belarus-regions': [
    ['Брест', 23.7341, 52.0976, 'Брестская область'],
    ['Витебск', 30.2049, 55.1904, 'Витебская область'],
    ['Гомель', 30.9754, 52.4345, 'Гомельская область'],
    ['Гродно', 23.8258, 53.6884, 'Гродненская область'],
    ['Могилёв', 30.3325, 53.9007, 'Могилёвская область'],
    ['Борисов', 28.5058, 54.2276, 'Минская область'],
    // Minsk the city is an enclave inside Minsk oblast, like Kyiv.
    ['Минск', 27.5615, 53.9045, 'Минск'],
  ],
  'usa-states': [
    ['Вашингтон', -77.0369, 38.9072, 'Округ Колумбия'],
    ['Нью-Йорк', -74.006, 40.7128, 'Нью-Йорк'],
    ['Лос-Анджелес', -118.2437, 34.0522, 'Калифорния'],
    ['Чикаго', -87.6298, 41.8781, 'Иллинойс'],
    ['Хьюстон', -95.3698, 29.7604, 'Техас'],
    ['Анкоридж', -149.9003, 61.2181, 'Аляска'],
    ['Гонолулу', -157.8583, 21.3069, 'Гавайи'],
    ['Майами', -80.1918, 25.7617, 'Флорида'],
    ['Денвер', -104.9903, 39.7392, 'Колорадо'],
    ['Сиэтл', -122.3321, 47.6062, 'Вашингтон'],
  ],
  'brazil-regions': [
    ['Манаус', -60.0217, -3.1019, 'Северный регион'],
    ['Ресифи', -34.8811, -8.0539, 'Северо-восточный регион'],
    ['Бразилиа', -47.8825, -15.7942, 'Центрально-западный регион'],
    // Goiânia is in Goiás — the state Wikidata forgot to link to its region.
    ['Гояния', -49.2648, -16.6869, 'Центрально-западный регион'],
    ['Сан-Паулу', -46.6333, -23.5505, 'Юго-восточный регион'],
    ['Порту-Алегри', -51.2177, -30.0346, 'Южный регион'],
  ],
  'belgium-provinces': [
    // Brussels is enclosed by Flemish Brabant, so it must be its own polygon.
    ['Брюссель', 4.3517, 50.8503, 'Брюссельский столичный регион'],
    ['Антверпен', 4.4025, 51.2194, 'Антверпен'],
    ['Гент', 3.7174, 51.0543, 'Восточная Фландрия'],
    ['Брюгге', 3.2247, 51.2093, 'Западная Фландрия'],
    ['Льеж', 5.5797, 50.6326, 'Льеж'],
    ['Намюр', 4.8674, 50.4674, 'Намюр'],
    ['Монс', 3.9522, 50.4542, 'Эно'],
    ['Хасселт', 5.3378, 50.9307, 'Лимбург'],
    ['Арлон', 5.8117, 49.6839, 'Люксембург'],
    ['Вавр', 4.6118, 50.7169, 'Валлонский Брабант'],
    ['Лёвен', 4.7005, 50.8798, 'Фламандский Брабант'],
  ],
  'bangladesh-divisions': [
    ['Дакка', 90.4125, 23.8103, 'Дакка'],
    ['Читтагонг', 91.8123, 22.3569, 'Читтагонг'],
    ['Кхулна', 89.5403, 22.8456, 'Кхулна'],
    ['Раджшахи', 88.6042, 24.3745, 'Раджшахи'],
    ['Силхет', 91.8687, 24.8949, 'Силхет'],
    ['Рангпур', 89.2752, 25.7439, 'Рангпур'],
    ['Барисал', 90.3535, 22.701, 'Барисал'],
    // The division split off from Dhaka in 2015 — the reason Natural Earth alone was not enough.
    ['Маймансингх', 90.4074, 24.7471, 'Маймансингх'],
  ],
  'austria-states': [
    // Vienna is a state in its own right, carved out of Lower Austria.
    ['Вена', 16.3738, 48.2082, 'Вена'],
    ['Грац', 15.4395, 47.0707, 'Штирия'],
    ['Линц', 14.2858, 48.3069, 'Верхняя Австрия'],
    ['Зальцбург', 13.055, 47.8095, 'Зальцбург'],
    ['Инсбрук', 11.4041, 47.2692, 'Тироль'],
    ['Клагенфурт', 14.3053, 46.6247, 'Каринтия'],
    ['Брегенц', 9.7471, 47.5031, 'Форарльберг'],
    ['Айзенштадт', 16.5188, 47.8457, 'Бургенланд'],
    ['Санкт-Пёльтен', 15.6256, 48.2047, 'Нижняя Австрия'],
    // Osttirol is separated from the rest of Tirol by Salzburg.
    ['Лиенц', 12.7697, 46.8295, 'Тироль'],
  ],
  'australia-states': [
    ['Сидней', 151.2093, -33.8688, 'Новый Южный Уэльс'],
    ['Мельбурн', 144.9631, -37.8136, 'Виктория'],
    ['Брисбен', 153.0251, -27.4698, 'Квинсленд'],
    ['Перт', 115.8605, -31.9505, 'Западная Австралия'],
    ['Аделаида', 138.6007, -34.9285, 'Южная Австралия'],
    ['Хобарт', 147.3272, -42.8821, 'Тасмания'],
    ['Дарвин', 130.8456, -12.4634, 'Северная территория'],
    ['Канберра', 149.1300, -35.2809, 'Австралийская столичная территория'],
  ],
  'argentina-provinces': [
    ['Буэнос-Айрес', -58.3816, -34.6037, 'Город Буэнос-Айрес'],
    ['Ла-Плата', -57.9545, -34.9215, 'Провинция Буэнос-Айрес'],
    ['Кордова', -64.1888, -31.4201, 'Кордова'],
    ['Мендоса', -68.8458, -32.8895, 'Мендоса'],
    ['Ушуая', -68.3029, -54.8019, 'Огненная Земля'],
    ['Сальта', -65.4117, -24.7859, 'Сальта'],
    ['Неукен', -68.0591, -38.9516, 'Неукен'],
    ['Росарио', -60.6393, -32.9442, 'Санта-Фе'],
  ],
  'slovenia-regions': [
    ['Любляна', 14.5058, 46.0569, 'Средняя Словения'],
    ['Марибор', 15.6467, 46.5547, 'Подравска'],
    ['Копер', 13.73, 45.5481, 'Обално-Крашка'],
    ['Мурска-Собота', 16.1667, 46.6583, 'Помурска'],
    ['Ново-Место', 15.17, 45.8033, 'Юго-Восточная Словения'],
    ['Крань', 14.3554, 46.2389, 'Гореньский регион'],
    ['Нова-Горица', 13.6483, 45.9553, 'Горишка'],
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
const areaRows = (
  await Promise.all(
    [
      'wikidata_areas_countries.json',
      'wikidata_areas_subdivisions.json',
      'wikidata_nuts_areas.json',
      'wikidata_class_areas.json',
      'wikidata_group_areas.json',
    ].map(async (file) =>
      JSON.parse(await readFile(resolve(CACHE, file), 'utf8')).results.bindings,
    ),
  )
).flat()
const SQUARE_KM = 'http://www.wikidata.org/entity/Q712226'
// Matching is by ISO code only. Names collide across levels — Wikidata has both
// the Agadez region (667 799 km²) and the Agadez commune (1 001 km²) as "Агадес",
// and a name-based match silently picked the wrong one.
const publishedByIso = new Map()
for (const row of areaRows) {
  if (row.unit.value !== SQUARE_KM) continue // a couple of entries are in m²
  const km2 = Number(row.area.value)
  // Grouped units have no ISO code; they are keyed by their Wikidata id instead.
  const group = row.group?.value?.replace(/.*\//, '')
  for (const iso of [row.iso3?.value, row.iso2?.value, row.nuts?.value, group]) {
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
