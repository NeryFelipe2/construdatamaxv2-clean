/**
 * utmToWgs84.ts — Pure UTM → WGS84 conversion utility.
 * Karney algorithm approximation. Used by MapaImportModal and MapaTransformCrsModal.
 *
 * Security: pure math, no side effects, no external calls, no eval.
 */

export function utmToWgs84(
  easting: number,
  northing: number,
  zone: number,
  hemisphere: 'N' | 'S',
): { lat: number; lng: number } {
  const k0 = 0.9996
  const a  = 6378137.0
  const e2 = 0.00669438
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))

  const x = easting - 500000
  const y = hemisphere === 'S' ? northing - 10000000 : northing

  const M  = y / k0
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256))

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)

  const N1  = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2)
  const T1  = Math.tan(phi1) ** 2
  const C1  = e2 / (1 - e2) * Math.cos(phi1) ** 2
  const R1  = a * (1 - e2) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5
  const D   = x / (N1 * k0)

  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e2 / (1 - e2)) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e2 / (1 - e2) - 3 * C1 ** 2) * D ** 6 / 720
  )

  const lng0   = (zone - 1) * 6 - 180 + 3
  const lngRad = (D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e2 / (1 - e2) + 24 * T1 ** 2) * D ** 5 / 120
  ) / Math.cos(phi1)

  return {
    lat: (lat * 180) / Math.PI,
    lng: lng0 + (lngRad * 180) / Math.PI,
  }
}
