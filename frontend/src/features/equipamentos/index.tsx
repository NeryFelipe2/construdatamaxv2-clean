import { useEquipamentosStore } from '@/store/equipamentosStore'
import { EquipamentosHeader } from './components/EquipamentosHeader'
import { EquipmentList }     from './components/EquipmentList'
import { EquipmentMap }      from './components/EquipmentMap'
import { AlertsPanel }       from './components/AlertsPanel'
import { EquipmentDialog }   from './components/EquipmentDialog'

export function EquipamentosPage() {
  const editingId = useEquipamentosStore((s) => s.editingId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EquipamentosHeader />

      {/* Main content: list + map side by side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — equipment list */}
        <div
          className="flex flex-col border-r border-[#525252] overflow-hidden shrink-0"
          style={{ width: 340 }}
        >
          <EquipmentList />
        </div>

        {/* Right panel — interactive map */}
        <div className="flex-1 overflow-hidden">
          <EquipmentMap />
        </div>
      </div>

      {/* Bottom — alerts bar */}
      <AlertsPanel />

      {/* Dialog overlay */}
      {editingId && <EquipmentDialog />}
    </div>
  )
}
