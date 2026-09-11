import { useCallback, useEffect, useRef, useState } from 'react'

export interface Camera {
  x: number
  y: number
  k: number
}

const IDENTITY: Camera = { x: 0, y: 0, k: 1 }
const MIN_K = 1
const MAX_K = 14

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Wheel + drag + pinch camera for the SVG map.
 *
 *  Pans are clamped so the map can never be dragged off-screen: at k=1 there is
 *  nothing to pan, and at higher zoom the visible window stays inside the map.
 */
export function useZoomPan(ref: React.RefObject<SVGSVGElement | null>) {
  const [camera, setCamera] = useState<Camera>(IDENTITY)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; k: number } | null>(null)
  const moved = useRef(false)

  const clampCamera = useCallback((next: Camera, width: number, height: number): Camera => {
    const k = clamp(next.k, MIN_K, MAX_K)
    const maxX = (width * (k - 1)) / 2
    const maxY = (height * (k - 1)) / 2
    return { k, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) }
  }, [])

  const reset = useCallback(() => setCamera(IDENTITY), [])

  useEffect(() => {
    const svg = ref.current
    if (!svg) return

    const size = () => {
      const r = svg.getBoundingClientRect()
      return { width: r.width, height: r.height, left: r.left, top: r.top }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { width, height, left, top } = size()
      const px = event.clientX - left - width / 2
      const py = event.clientY - top - height / 2
      setCamera((cam) => {
        const k = clamp(cam.k * Math.exp(-event.deltaY * 0.002), MIN_K, MAX_K)
        const ratio = k / cam.k
        // Keep the point under the cursor pinned while zooming.
        return clampCamera({ k, x: px - (px - cam.x) * ratio, y: py - (py - cam.y) * ratio }, width, height)
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      moved.current = false
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), k: camera.k }
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const prev = pointers.current.get(event.pointerId)
      if (!prev) return
      const next = { x: event.clientX, y: event.clientY }
      pointers.current.set(event.pointerId, next)
      const { width, height } = size()

      if (pointers.current.size === 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const start = pinchStart.current
        moved.current = true
        setCamera((cam) => clampCamera({ ...cam, k: start.k * (distance / start.distance) }, width, height))
        return
      }

      const dx = next.x - prev.x
      const dy = next.y - prev.y
      if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true
      setCamera((cam) => clampCamera({ ...cam, x: cam.x + dx, y: cam.y + dy }, width, height))
    }

    const onPointerUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId)
      if (pointers.current.size < 2) pinchStart.current = null
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      svg.removeEventListener('wheel', onWheel)
      svg.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [ref, camera.k, clampCamera])

  /** True when the gesture that just ended was a drag, so it shouldn't select a region. */
  const wasDragged = useCallback(() => moved.current, [])

  return { camera, reset, wasDragged }
}
