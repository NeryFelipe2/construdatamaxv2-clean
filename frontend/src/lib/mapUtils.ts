import type { Map as LeafletMap } from 'leaflet'

/**
 * flyTo seguro: o flyTo do Leaflet produz NaN (e lança "Invalid LatLng object:
 * (NaN, NaN)") quando o container ainda mede 0×0 no mount ou quando o destino
 * coincide com o centro atual. Sem error boundary isso derruba a árvore React
 * inteira, então toda animação de mapa deve passar por aqui.
 */
export function safeFlyTo(map: LeafletMap, lat: unknown, lng: unknown, minZoom = 15): void {
  if (!Number.isFinite(lat as number) || !Number.isFinite(lng as number)) return
  const target: [number, number] = [lat as number, lng as number]
  const currentZoom = map.getZoom()
  const zoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, minZoom) : minZoom
  try {
    const size = map.getSize()
    if (!size.x || !size.y) {
      // container sem layout — setView não anima e não faz a matemática que gera NaN
      map.setView(target, zoom)
      return
    }
    const center = map.getCenter()
    if (Math.abs(center.lat - target[0]) < 1e-9 && Math.abs(center.lng - target[1]) < 1e-9 && currentZoom === zoom) {
      return
    }
    map.flyTo(target, zoom, { duration: 0.9 })
  } catch {
    try { map.setView(target, zoom, { animate: false }) } catch { /* mapa em estado inválido — não derrubar a página */ }
  }
}
