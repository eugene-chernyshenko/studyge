// Planar ray-casting hit test in raw lon/lat.
//
// d3-geo's geoContains is spherical and silently inverts a polygon whose exterior
// ring winds the wrong way — geoBoundaries has such rings, which made single
// municipalities swallow half the country. At these latitudes and sizes the flat
// test is both correct and unambiguous.
function inRing(ring, [x, y]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(rings, point) {
  if (!inRing(rings[0], point)) return false
  for (let i = 1; i < rings.length; i++) if (inRing(rings[i], point)) return false // hole
  return true
}

export function contains(geometry, point) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') return inPolygon(geometry.coordinates, point)
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.some((rings) => inPolygon(rings, point))
  return false
}

/** Absolute shoelace area in degrees², used only to rank/drop  degenerate slivers. */
export function planarArea(geometry) {
  const ring = (r) => {
    let sum = 0
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      sum += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1])
    }
    return Math.abs(sum / 2)
  }
  if (!geometry) return 0
  if (geometry.type === 'Polygon') return ring(geometry.coordinates[0])
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.reduce((s, rings) => s + ring(rings[0]), 0)
  return 0
}

/** Great-circle distance in km from a point to the nearest vertex of a geometry. */
export function distanceToKm(geometry, [lon, lat]) {
  const rad = (d) => (d * Math.PI) / 180
  const haversine = ([bLon, bLat]) => {
    const dLat = rad(bLat - lat)
    const dLon = rad(bLon - lon)
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
    return 6371 * 2 * Math.asin(Math.sqrt(h))
  }
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.flat()
        : []
  let best = Infinity
  for (const ring of rings) for (const point of ring) best = Math.min(best, haversine(point))
  return best
}
