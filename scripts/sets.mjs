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
