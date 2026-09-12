// Every playable map set. `source` decides where geometry comes from:
//   ne-admin0  — Natural Earth 50m countries
//   ne-admin1  — Natural Earth 10m states/provinces, filtered by `adm0`
//   geoboundaries — a cached geoBoundaries download (used where NE is incomplete)
export const SETS = [
  {
    id: 'world-countries',
    title: 'Страны мира',
    group: 'Мир',
    unit: ['страна', 'страны', 'стран'],
    source: { kind: 'ne-admin0' },
    projection: 'equalEarth',
    // Built from Natural Earth 10m: at 50m the median area error against
    // published figures was 3.7%, here it is 1.6% for ~120 KB more.
    simplify: '4%',
    modes: ['learn', 'locate', 'flag', 'capital'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'russia-subjects',
    title: 'Субъекты России',
    group: 'Административные единицы',
    country: 'Россия',
    unit: ['субъект', 'субъекта', 'субъектов'],
    source: {
      kind: 'ne-admin1',
      adm0: 'RUS',
      // Natural Earth files these four under Ukraine; the set is built to the
      // composition of 89 subjects, so they are pulled in by ISO code.
      include: ['UA-14', 'UA-09', 'UA-23', 'UA-65'],
      // An unnamed placeholder polygon of 0.008 deg² that NE ships for Russia.
      exclude: ['RU-X01~'],
    },
    // Russia crosses the antimeridian, so an unrotated projection would smear it
    // across the whole width. Conic equal-area centred on 100°E keeps it readable.
    projection: 'conic',
    rotate: [-100, 0],
    parallels: [50, 70],
    // 5% put Vladivostok 7 km outside its own coastline; 10% brings it back in.
    simplify: '10%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'ukraine-oblasts',
    title: 'Области Украины',
    group: 'Административные единицы',
    country: 'Украина',
    unit: ['единица', 'единицы', 'единиц'],
    source: {
      kind: 'ne-admin1',
      adm0: 'UKR',
      // The four oblasts that the set of Russian subjects already covers, so the
      // two sets stay disjoint. Crimea and Sevastopol are filed under Russia in
      // Natural Earth and are therefore absent here as well.
      exclude: ['UA-14', 'UA-09', 'UA-23', 'UA-65'],
    },
    projection: 'mercator',
    simplify: '10%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'belarus-regions',
    title: 'Области Беларуси',
    group: 'Административные единицы',
    country: 'Беларусь',
    unit: ['единица', 'единицы', 'единиц'],
    source: { kind: 'ne-admin1', adm0: 'BLR' },
    projection: 'mercator',
    simplify: '14%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'usa-states',
    title: 'Штаты США и округ Колумбия',
    group: 'Административные единицы',
    country: 'США',
    unit: ['единица', 'единицы', 'единиц'],
    // The District of Columbia is not a state, but leaving it out punches a hole
    // in the map that belongs to nothing and cannot be clicked.
    source: { kind: 'ne-admin1', adm0: 'USA' },
    // Alaska and Hawaii would stretch any single projection across the Pacific.
    // d3's composite Albers places them as insets, which is the usual US map.
    projection: 'albersUsa',
    // 8% dropped lower Manhattan into the harbour — New York needs the detail.
    simplify: '25%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'brazil-regions',
    title: 'Регионы Бразилии',
    group: 'Административные единицы',
    country: 'Бразилия',
    unit: ['регион', 'региона', 'регионов'],
    // The five macro-regions have no geometry of their own in any open source;
    // they are dissolved from the 27 states using Wikidata's membership data.
    source: { kind: 'grouped', adm0: 'BRA' },
    projection: 'conic',
    rotate: [55, 0],
    parallels: [-25, -5],
    simplify: '12%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'belgium-provinces',
    title: 'Провинции Бельгии и Брюссель',
    group: 'Административные единицы',
    country: 'Бельгия',
    unit: ['единица', 'единицы', 'единиц'],
    // Brussels is a region, not a province, but it is an enclave inside Flemish
    // Brabant: leaving it out would punch a hole belonging to nothing.
    source: { kind: 'ne-admin1', adm0: 'BEL' },
    projection: 'mercator',
    simplify: '30%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'bangladesh-divisions',
    title: 'Области Бангладеш',
    group: 'Административные единицы',
    country: 'Бангладеш',
    unit: ['область', 'области', 'областей'],
    // Natural Earth still shows seven divisions: Mymensingh was split off from
    // Dhaka in 2015 and only geoBoundaries has it.
    source: { kind: 'geoboundaries', file: 'gb_BGD_ADM1.geojson', isoPrefix: 'BD-' },
    projection: 'mercator',
    simplify: '20%',
    modes: ['learn', 'locate'],
    attribution: 'geoBoundaries (CC BY 4.0)',
  },
  {
    id: 'austria-states',
    title: 'Земли Австрии',
    group: 'Административные единицы',
    country: 'Австрия',
    unit: ['земля', 'земли', 'земель'],
    source: { kind: 'ne-admin1', adm0: 'AUT' },
    projection: 'mercator',
    simplify: '30%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'australia-states',
    title: 'Штаты и территории Австралии',
    group: 'Административные единицы',
    country: 'Австралия',
    unit: ['единица', 'единицы', 'единиц'],
    source: {
      kind: 'ne-admin1',
      adm0: 'AUS',
      // Natural Earth carries three island entries alongside the eight units:
      // Macquarie belongs to Tasmania, Lord Howe to New South Wales (it even
      // shares its AU-NSW code), and Jervis Bay is a 70 km² enclave.
      excludeNames: ['Macquarie Island', 'Lord Howe Island', 'Jervis Bay Territory'],
    },
    projection: 'conic',
    rotate: [-134, 0],
    parallels: [-36, -18],
    // Darwin sits on a narrow point: 12% left it 4.2 km offshore, 40% brings it
    // to 0.5 km. It never lands inside — the coastline of the source is simply
    // drawn past it — but the outline is much better at this level.
    simplify: '40%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'argentina-provinces',
    title: 'Провинции Аргентины',
    group: 'Административные единицы',
    country: 'Аргентина',
    unit: ['единица', 'единицы', 'единиц'],
    source: { kind: 'ne-admin1', adm0: 'ARG' },
    // The country runs from 22°S to 55°S; Mercator would blow up Patagonia.
    projection: 'conic',
    rotate: [65, 0],
    parallels: [-45, -25],
    simplify: '12%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'slovenia-regions',
    title: 'Регионы Словении',
    group: 'Административные единицы',
    country: 'Словения',
    unit: ['регион', 'региона', 'регионов'],
    // The 12 statistical regions are NUTS level 3; Natural Earth and
    // geoBoundaries only know municipalities and the two cohesion regions.
    source: { kind: 'nuts', country: 'SI' },
    projection: 'mercator',
    simplify: '25%',
    modes: ['learn', 'locate'],
    attribution: '© EuroGeographics (Eurostat GISCO)',
  },
  {
    id: 'slovenia-municipalities',
    title: 'Общины Словении',
    group: 'Административные единицы',
    country: 'Словения',
    unit: ['община', 'общины', 'общин'],
    source: { kind: 'geoboundaries', file: 'gb_SVN_ADM2.geojson', isoPrefix: 'SI-' },
    // geoBoundaries extends coastal units into territorial waters.
    clipToLand: true,
    projection: 'mercator',
    simplify: '12%',
    modes: ['learn', 'locate'],
    attribution: 'geoBoundaries (CC BY 4.0)',
  },
  {
    id: 'timor-municipalities',
    title: 'Муниципалитеты Восточного Тимора',
    group: 'Административные единицы',
    country: 'Восточный Тимор',
    unit: ['муниципалитет', 'муниципалитета', 'муниципалитетов'],
    source: { kind: 'ne-admin1', adm0: 'TLS' },
    projection: 'mercator',
    simplify: '10%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'myanmar-states',
    title: 'Штаты и области Мьянмы',
    group: 'Административные единицы',
    country: 'Мьянма',
    unit: ['штат или область', 'штата и области', 'штатов и областей'],
    source: { kind: 'ne-admin1', adm0: 'MMR' },
    projection: 'mercator',
    simplify: '8%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'niger-regions',
    title: 'Регионы Нигера',
    group: 'Административные единицы',
    country: 'Нигер',
    unit: ['регион', 'региона', 'регионов'],
    source: { kind: 'ne-admin1', adm0: 'NER' },
    projection: 'mercator',
    simplify: '8%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'mali-regions',
    title: 'Регионы Мали',
    group: 'Административные единицы',
    country: 'Мали',
    unit: ['регион', 'региона', 'регионов'],
    source: { kind: 'ne-admin1', adm0: 'MLI' },
    projection: 'mercator',
    simplify: '8%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'chad-provinces',
    title: 'Регионы Чада',
    group: 'Административные единицы',
    country: 'Чад',
    unit: ['регион', 'региона', 'регионов'],
    source: { kind: 'geoboundaries', file: 'gb_TCD_ADM1.geojson', isoPrefix: 'TD-' },
    projection: 'mercator',
    simplify: '8%',
    modes: ['learn', 'locate'],
    attribution: 'geoBoundaries (CC BY 4.0)',
  },
  {
    id: 'car-prefectures',
    title: 'Префектуры ЦАР',
    group: 'Административные единицы',
    country: 'Центральноафриканская Республика',
    unit: ['префектура', 'префектуры', 'префектур'],
    source: { kind: 'ne-admin1', adm0: 'CAF' },
    projection: 'mercator',
    simplify: '8%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
  {
    id: 'south-sudan-states',
    title: 'Штаты Южного Судана',
    group: 'Административные единицы',
    country: 'Южный Судан',
    unit: ['штат', 'штата', 'штатов'],
    source: { kind: 'ne-admin1', adm0: 'SDS' },
    projection: 'mercator',
    simplify: '8%',
    modes: ['learn', 'locate'],
    attribution: 'Natural Earth (public domain)',
  },
]
