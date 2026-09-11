import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { MapSet, MapSetMeta, Region } from './types'

const BASE = import.meta.env.BASE_URL

let manifestPromise: Promise<MapSetMeta[]> | undefined
const setCache = new Map<string, Promise<MapSet>>()

export function loadManifest(): Promise<MapSetMeta[]> {
  manifestPromise ??= fetch(`${BASE}data/manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`manifest: HTTP ${r.status}`)
    return r.json() as Promise<MapSetMeta[]>
  })
  return manifestPromise
}

/** Map sets are immutable and small (3–174 KB), so one fetch per set per session. */
export function loadSet(meta: MapSetMeta): Promise<MapSet> {
  const cached = setCache.get(meta.id)
  if (cached) return cached

  const promise = fetch(`${BASE}${meta.file}`)
    .then((r) => {
      if (!r.ok) throw new Error(`${meta.id}: HTTP ${r.status}`)
      return r.json() as Promise<Topology>
    })
    .then((topo) => {
      const collection = feature(
        topo,
        topo.objects.regions as GeometryCollection,
      ) as GeoJSON.FeatureCollection
      const regions: Region[] = collection.features.map((f) => {
        const p = f.properties as Record<string, unknown>
        return {
          id: String(p.id),
          name: String(p.name),
          nameEn: String(p.nameEn ?? p.name),
          c: p.c as [number, number],
          a: Number(p.a ?? 0),
          iso2: p.iso2 as string | undefined,
          capital: (p.capital as string | null) ?? null,
          // Countries carry a capital, regions carry a seat — same thing on the map.
          centre: ((p.capital ?? p.seat) as string | null) ?? null,
          centreAt: ((p.capitalAt ?? p.seatAt) as [number, number] | null) ?? null,
          geometry: f.geometry,
        }
      })
      return { meta, regions }
    })

  setCache.set(meta.id, promise)
  return promise
}
