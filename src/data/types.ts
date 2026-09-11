/** 'learn' is the no-pressure browse mode; the rest are quiz modes. */
export type GameMode = 'learn' | 'locate' | 'flag' | 'capital'
export type QuizMode = Exclude<GameMode, 'learn'>

/** One entry of public/data/manifest.json — everything needed to list a set in the menu. */
export interface MapSetMeta {
  id: string
  title: string
  group: string
  country: string | null
  unitPlural: string
  count: number
  modes: GameMode[]
  projection: 'equalEarth' | 'mercator' | 'conic'
  /** Only for 'conic': rotation and standard parallels, for countries too wide
   *  or too far east for an unrotated projection (Russia crosses 180°). */
  rotate?: [number, number]
  parallels?: [number, number]
  bbox: [number, number, number, number]
  file: string
  attribution: string
}

export interface Region {
  id: string
  name: string
  nameEn: string
  /** Centroid [lon, lat] — used to centre the camera on an answer. */
  c: [number, number]
  /** Spherical area in steradians. */
  a: number
  iso2?: string
  capital?: string | null
  /** Administrative centre: the seat town of a region, or a country's capital. */
  centre?: string | null
  /** Where to draw the centre's dot, [lon, lat]. */
  centreAt?: [number, number] | null
  geometry: GeoJSON.Geometry
}

export interface MapSet {
  meta: MapSetMeta
  regions: Region[]
}
