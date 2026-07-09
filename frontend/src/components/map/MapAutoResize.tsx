import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * O Leaflet mede o container uma única vez no mount. Quando o mapa nasce dentro
 * de uma aba oculta (0×0) e só depois fica visível, os tiles renderizam num
 * canto. Este watcher chama invalidateSize() a cada mudança de tamanho real.
 */
export function MapAutoResize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(container)
    map.invalidateSize()
    return () => observer.disconnect()
  }, [map])

  return null
}
