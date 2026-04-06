import { useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import type { EquipmentStatus } from '@/types'
import { STATUS_CONFIG } from '../constants'
import { EquipmentCard } from './EquipmentCard'

const FILTERS: { label: string; value: EquipmentStatus | 'all' }[] = [
  { label: 'Todos',      value: 'all'         },
  { label: 'Ativos',     value: 'active'      },
  { label: 'Parados',    value: 'idle'        },
  { label: 'Manutenção', value: 'maintenance' },
  { label: 'Alerta',     value: 'alert'       },
  { label: 'Inativos',   value: 'offline'     },
]

export function EquipmentList() {
  const equipamentos    = useEquipamentosStore((s) => s.equipamentos)
  const selectedId      = useEquipamentosStore((s) => s.selectedId)
  const selectEquipamento = useEquipamentosStore((s) => s.selectEquipamento)
  const setEditing      = useEquipamentosStore((s) => s.setEditing)

  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'all'>('all')

  const filtered = equipamentos.filter((eq) => {
    const term = search.trim().toLowerCase()
    const matchSearch =
      !term ||
      eq.name.toLowerCase().includes(term) ||
      eq.code.toLowerCase().includes(term) ||
      eq.type.toLowerCase().includes(term) ||
      (eq.siteName ?? '').toLowerCase().includes(term)
    const matchStatus = statusFilter === 'all' || eq.status === statusFilter
    return matchSearch && matchStatus
  })

  // Status counts for badges
  const counts = equipamentos.reduce<Record<string, number>>(
    (acc, eq) => ({ ...acc, [eq.status]: (acc[eq.status] ?? 0) + 1 }),
    {}
  )

  return (
    <>
      {/* Search + filter */}
      <div className="flex flex-col gap-2 p-3 border-b border-[#525252] shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código ou obra..."
            className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-8 pr-3 py-2 text-xs text-[#f5f5f5] placeholder:text-[#3f3f3f] outline-none focus:border-[#f97316] transition-colors"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => {
            const count = f.value === 'all' ? equipamentos.length : (counts[f.value] ?? 0)
            const active = statusFilter === f.value
            const dotColor = f.value !== 'all' ? STATUS_CONFIG[f.value as EquipmentStatus].color : undefined
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors',
                  active
                    ? 'bg-[#f97316] border-[#f97316] text-white'
                    : 'border-[#525252] text-[#6b6b6b] hover:border-[#1f3c5e] hover:text-[#a3a3a3]'
                )}
              >
                {dotColor && !active && (
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: dotColor }}
                  />
                )}
                {f.label}
                <span className={cn('font-mono', active ? 'opacity-80' : 'text-[#3f3f3f]')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 text-xs text-[#3f3f3f]">
            Nenhum equipamento encontrado
          </div>
        ) : (
          filtered.map((eq) => (
            <EquipmentCard
              key={eq.id}
              equipment={eq}
              isSelected={selectedId === eq.id}
              onSelect={() => selectEquipamento(selectedId === eq.id ? null : eq.id)}
              onEdit={() => setEditing(eq.id)}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-[#525252] shrink-0 text-[10px] text-[#3f3f3f]">
        {filtered.length} de {equipamentos.length} equipamentos
      </div>
    </>
  )
}
