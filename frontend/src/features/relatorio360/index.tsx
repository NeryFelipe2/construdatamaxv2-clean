import { useCurrentReport } from '@/hooks/useRelatorio360'
import { ReportHeader } from './components/ReportHeader'
import { SummaryRow } from './components/SummaryRow'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { CrewsPanel } from './components/CrewsPanel'
import { EquipmentPanel } from './components/EquipmentPanel'
import { MaterialsPanel } from './components/MaterialsPanel'
import { PhotosPanel } from './components/PhotosPanel'

export function Relatorio360Page() {
  const report = useCurrentReport()

  return (
    <div className="flex flex-col min-h-screen">
      <ReportHeader />

      {report ? (
        <>
          <SummaryRow />

          <div className="flex flex-col gap-6 px-6 pb-8">
            {/* Kanban - full width */}
            <section>
              <KanbanBoard />
            </section>

            {/* Two-column grid: Crews + Equipment/Materials */}
            <div className="grid grid-cols-3 gap-6">
              {/* Equipes — 1 col */}
              <div className="col-span-1">
                <CrewsPanel />
              </div>

              {/* Equipment + Materials stacked — 2 cols */}
              <div className="col-span-2 flex flex-col gap-6">
                <EquipmentPanel />
                <MaterialsPanel />
              </div>
            </div>

            {/* Photos - full width */}
            <section>
              <PhotosPanel />
            </section>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-[#6b6b6b] text-sm">Nenhum relatório encontrado para esta data.</p>
          <p className="text-[#3f3f3f] text-xs">Use as setas para navegar entre os dias.</p>
        </div>
      )}
    </div>
  )
}
