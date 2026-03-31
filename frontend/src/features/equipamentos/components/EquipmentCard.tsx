import { MapPin, Clock, User, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EquipmentProfile } from '@/types'
import { STATUS_CONFIG } from '../constants'

interface Props {
  equipment: EquipmentProfile
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
}

export function EquipmentCard({ equipment, isSelected, onSelect, onEdit }: Props) {
  const cfg = STATUS_CONFIG[equipment.status]
  const activeAlerts = equipment.alerts.filter((a) => !a.acknowledged)

  return (
    <div
      onClick={onSelect}
      className={cn(
        'rounded-xl border p-3.5 cursor-pointer transition-all flex flex-col gap-2',
        isSelected
          ? 'border-[#2abfdc]/50 bg-[#2abfdc]/5 shadow-sm'
          : 'border-[#20406a] bg-[#112645] hover:border-[#1f3c5e] hover:bg-[#14294e]'
      )}
    >
      {/* Top row: code + status badge + alert count */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
            style={{ background: cfg.color }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#2abfdc] font-mono text-xs font-semibold">{equipment.code}</span>
              <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">{equipment.type}</span>
            </div>
            <p className="text-[#f5f5f5] font-semibold text-sm leading-snug truncate">
              {equipment.name}
            </p>
            <p className="text-[#6b6b6b] text-xs">
              {equipment.brand} {equipment.model} · {equipment.year}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
            style={{ background: cfg.colorMuted, color: cfg.color }}
          >
            {cfg.label}
          </span>
          {activeAlerts.length > 0 && (
            <span className="text-[10px] font-bold text-white bg-[#ef4444] rounded-full w-5 h-5 flex items-center justify-center">
              {activeAlerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-[11px] text-[#6b6b6b] flex-wrap">
        {equipment.siteName && (
          <span className="flex items-center gap-1 truncate max-w-[140px]">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{equipment.siteName}</span>
          </span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          <Clock size={10} />
          {equipment.engineHours.toLocaleString('pt-BR')}h motor
        </span>
        {equipment.operator && (
          <span className="flex items-center gap-1 truncate max-w-[110px]">
            <User size={10} className="shrink-0" />
            <span className="truncate">{equipment.operator}</span>
          </span>
        )}
      </div>

      {/* Edit link */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        className="self-start flex items-center gap-1 text-[10px] text-[#3f3f3f] hover:text-[#2abfdc] transition-colors mt-0.5"
      >
        <Pencil size={9} />
        Editar perfil
      </button>
    </div>
  )
}
