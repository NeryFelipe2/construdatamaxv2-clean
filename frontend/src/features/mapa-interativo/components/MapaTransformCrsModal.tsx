/**
 * MapaTransformCrsModal — UTM ↔ WGS84 coordinate transformation helper.
 * Converts a single UTM point to geographic coordinates for verification.
 */
import { useState } from 'react'
import { X, ArrowRightLeft } from 'lucide-react'
import { utmToWgs84 } from '@/utils/utmToWgs84'

interface Props {
  onClose: () => void
  defaultZone?: string
}

export function MapaTransformCrsModal({ onClose, defaultZone = '24S' }: Props) {
  const [easting,  setEasting]   = useState('')
  const [northing, setNorthing]  = useState('')
  const [zone,     setZone]      = useState(defaultZone.slice(0, -1))
  const [hemi,     setHemi]      = useState<'N' | 'S'>(defaultZone.endsWith('N') ? 'N' : 'S')
  const [result,   setResult]    = useState<{ lat: number; lng: number } | null>(null)
  const [error,    setError]     = useState('')

  function convert() {
    const e = parseFloat(easting)
    const n = parseFloat(northing)
    const z = parseInt(zone)
    if (isNaN(e) || isNaN(n) || isNaN(z) || z < 1 || z > 60) {
      setError('Valores inválidos. Zona deve ser 1–60.')
      setResult(null)
      return
    }
    try {
      const r = utmToWgs84(e, n, z, hemi)
      setResult(r)
      setError('')
    } catch {
      setError('Erro na conversão. Verifique os valores.')
      setResult(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={14} className="text-orange-400" />
            <h3 className="text-sm font-bold text-white">Transformar CRS</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs text-gray-500">Converta coordenadas UTM para WGS84 (lat/lng).</p>

          {/* Zone + Hemisphere */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Zona UTM</label>
              <input
                type="number" min={1} max={60}
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Hemisfério</label>
              <select
                value={hemi}
                onChange={(e) => setHemi(e.target.value as 'N' | 'S')}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="S">Sul (S)</option>
                <option value="N">Norte (N)</option>
              </select>
            </div>
          </div>

          {/* Easting + Northing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Easting (E)</label>
              <input
                type="number"
                value={easting}
                onChange={(e) => setEasting(e.target.value)}
                placeholder="Ex: 558000"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Northing (N)</label>
              <input
                type="number"
                value={northing}
                onChange={(e) => setNorthing(e.target.value)}
                placeholder="Ex: 8567000"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-300 font-mono">Lat: {result.lat.toFixed(8)}</p>
              <p className="text-xs text-green-300 font-mono">Lng: {result.lng.toFixed(8)}</p>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Fechar
          </button>
          <button
            onClick={convert}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Converter
          </button>
        </div>
      </div>
    </div>
  )
}
