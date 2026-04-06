import { Truck, Plus } from 'lucide-react'
import { useEquipamentosStore } from '@/store/equipamentosStore'

export function EquipamentosHeader() {
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const setEditing   = useEquipamentosStore((s) => s.setEditing)

  const alertCount = equipamentos.reduce(
    (n, e) => n + e.alerts.filter((a) => !a.acknowledged).length,
    0
  )

  return (
    <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252] bg-[#333333] shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
          <Truck size={18} className="text-[#f97316]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] font-bold text-base">Perfil dos Equipamentos</h1>
          <p className="text-[#6b6b6b] text-xs">
            {equipamentos.length} equipamentos
            {alertCount > 0 && (
              <span className="text-[#ef4444] ml-1">· {alertCount} alerta{alertCount !== 1 ? 's' : ''} ativo{alertCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </div>

      <button
        onClick={() => setEditing('new')}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors"
      >
        <Plus size={14} />
        Adicionar Equipamento
      </button>
    </div>
  )
}
