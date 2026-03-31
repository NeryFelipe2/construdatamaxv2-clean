import { useProjetosStore } from '@/store/projetosStore'
import { ProjetosSidebar } from './components/ProjetosSidebar'
import { ProjetosDetail }  from './components/ProjetosDetail'
import { ProjectDialog }   from './components/ProjectDialog'
import { PhaseDialog }     from './components/PhaseDialog'
import { BudgetDialog }    from './components/BudgetDialog'

export function ProjetosPage() {
  const editingProjectId  = useProjetosStore((s) => s.editingProjectId)
  const editingPhase      = useProjetosStore((s) => s.editingPhase)
  const editingBudgetLine = useProjetosStore((s) => s.editingBudgetLine)

  return (
    <div className="flex h-full overflow-hidden">
      <ProjetosSidebar />
      <ProjetosDetail />

      {editingProjectId  && <ProjectDialog />}
      {editingPhase      && <PhaseDialog />}
      {editingBudgetLine && <BudgetDialog />}
    </div>
  )
}
