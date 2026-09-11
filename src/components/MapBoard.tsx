import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { geoAlbersUsa, geoConicEqualArea, geoEqualEarth, geoMercator, geoPath } from 'd3-geo'
import type { MapSet, Region } from '../data/types'
import { useZoomPan } from './useZoomPan'

const HUD_TOP = 72
const HUD_BOTTOM = 96
/** Regions smaller than this on screen get a ring drawn around them. */
const MARKER_BELOW_PX = 26

export interface Reveal {
  correctId: string
  pickedId: string | null
}

interface Props {
  onReady?: () => void
  /** Draw a dot for each region's capital or administrative centre. */
  showCentres?: boolean
  set: MapSet
  selectedId: string | null
  reveal: Reveal | null
  /** regionId -> fill colour for regions already answered this round. */
  answered: Map<string, string>
  onSelect: (regionId: string) => void
  interactive: boolean
}

function buildProjection(meta: MapSet['meta']) {
  if (meta.projection === 'equalEarth') return geoEqualEarth()
  // Composite: Alaska and Hawaii are drawn as insets rather than in place.
  if (meta.projection === 'albersUsa') return geoAlbersUsa()
  if (meta.projection !== 'conic') return geoMercator()
  const projection = geoConicEqualArea()
  if (meta.rotate) projection.rotate(meta.rotate)
  if (meta.parallels) projection.parallels(meta.parallels)
  return projection
}

function useSize(ref: React.RefObject<Element | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    // Measure up front rather than waiting on the observer's first delivery:
    // under StrictMode's mount/unmount/mount the initial notification can be
    // dropped, which used to leave the board sized 0×0 and the map invisible.
    const measure = ({ width, height }: { width: number; height: number }) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    measure(element.getBoundingClientRect())
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

export function MapBoard({ set, selectedId, reveal, answered, onSelect, interactive, onReady, showCentres }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useSize(wrapperRef)
  const { camera, reset, wasDragged } = useZoomPan(svgRef)

  // Projecting 200+ polygons is the expensive part; redo it only on resize.
  const { paths, project, smallOnScreen } = useMemo<{
    paths: { region: Region; d: string }[]
    project: ((lonLat: [number, number]) => [number, number] | null) | null
    smallOnScreen: Set<string>
  }>(() => {
    if (!width || !height) return { paths: [], project: null, smallOnScreen: new Set() }
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: set.regions.map((r) => ({ type: 'Feature', properties: null, geometry: r.geometry })),
    }
    const projection = buildProjection(set.meta)
    // Leave room for the floating HUD so no region sits permanently under it.
    projection.fitExtent(
      [
        [16, HUD_TOP],
        [width - 16, height - HUD_BOTTOM],
      ],
      collection,
    )
    const path = geoPath(projection)
    // Island states shrink to a couple of pixels; they need a marker, not a fill.
    const smallOnScreen = new Set<string>()
    const paths = set.regions.map((region) => {
      const [[x0, y0], [x1, y1]] = path.bounds(region.geometry)
      if (Math.max(x1 - x0, y1 - y0) < MARKER_BELOW_PX) smallOnScreen.add(region.id)
      return { region, d: path(region.geometry) ?? '' }
    })
    return { paths, project: (lonLat: [number, number]) => projection(lonLat), smallOnScreen }
  }, [set, width, height])

  useLayoutEffect(reset, [set.meta.id, reset])

  useEffect(() => {
    if (paths.length) onReady?.()
  }, [paths, onReady])

  const centres = useMemo(() => {
    if (!showCentres || !project) return []
    return set.regions.flatMap((region) => {
      if (!region.centreAt) return []
      const at = project(region.centreAt)
      return at ? [{ id: region.id, at }] : []
    })
  }, [showCentres, project, set.regions])

  // Ring the answer when the region itself is too small to read as a fill.
  const marker = useMemo(() => {
    if (!reveal || !project) return null
    const correct = set.regions.find((r) => r.id === reveal.correctId)
    if (!correct || !smallOnScreen.has(correct.id)) return null
    return project(correct.c)
  }, [reveal, project, set.regions, smallOnScreen])

  return (
    <div className="map" ref={wrapperRef}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={interactive ? 'map__svg' : 'map__svg map__svg--locked'}
      >
        <g transform={`translate(${width / 2} ${height / 2}) scale(${camera.k}) translate(${-width / 2 + camera.x / camera.k} ${-height / 2 + camera.y / camera.k})`}>
          {paths.map(({ region, d }) => {
            const state =
              reveal?.correctId === region.id
                ? 'correct'
                : reveal && reveal.pickedId === region.id
                  ? 'wrong'
                  : selectedId === region.id
                    ? 'selected'
                    : answered.has(region.id)
                      ? 'answered'
                      : 'idle'
            return (
              <path
                key={region.id}
                d={d}
                className={`region region--${state}`}
                style={state === 'answered' ? { fill: answered.get(region.id) } : undefined}
                strokeWidth={0.7 / camera.k}
                onClick={() => {
                  if (interactive && !wasDragged()) onSelect(region.id)
                }}
              >
                <title>{region.name}</title>
              </path>
            )
          })}

          {centres.map(({ id, at }) => (
            <circle
              key={`centre-${id}`}
              cx={at[0]}
              cy={at[1]}
              r={2.4 / camera.k}
              className="centre-dot"
              strokeWidth={1 / camera.k}
            />
          ))}

          {marker ? (
            <circle
              cx={marker[0]}
              cy={marker[1]}
              r={16 / camera.k}
              className="marker"
              strokeWidth={3 / camera.k}
            />
          ) : null}
        </g>
      </svg>
    </div>
  )
}
