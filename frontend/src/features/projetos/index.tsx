import { useState } from 'react'
import { useProjetosStore } from '@/store/projetosStore'
import { ProjetosSidebar } from './components/ProjetosSidebar'
import { ProjetosDetail }  from './components/ProjetosDetail'
import { ProjectDialog }   from './components/ProjectDialog'
import { PhaseDialog }     from './components/PhaseDialog'
import { BudgetDialog }    from './components/BudgetDialog'

type MobileTab = 'lista' | 'detalhe'

const MOBILE_TABS: { key: MobileTab; label: string }[] = [
  { key: 'lista',   label: 'Lista' },
  { key: 'detalhe', label: 'Detalhes' },
]

export function ProjetosPage() {
  const editingProjectId  = useProjetosStore((s) => s.editingProjectId)
  const editingPhase      = useProjetosStore((s) => s.editingPhase)
  const editingBudgetLine = useProjetosStore((s) => s.editingBudgetLine)
  const [mobileTab, setMobileTab] = useState<MobileTab>('lista')

  return (
    <>
      {/* Mobile tab bar */}
      <div className="flex lg:hidden border-b border-[#525252] bg-[#2c2c2c] shrink-0">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              mobileTab === tab.key
                ? 'text-[#f97316] border-b-2 border-[#f97316]'
                : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={`${mobileTab === 'lista' ? 'flex flex-1 lg:flex-initial' : 'hidden'} lg:flex flex-col`}>
          <ProjetosSidebar />
        </div>
        <div className={`${mobileTab === 'detalhe' ? 'flex flex-1' : 'hidden'} lg:flex lg:flex-1`}>
          <ProjetosDetail />
        </div>
      </div>

      {editingProjectId  && <ProjectDialog />}
      {editingPhase      && <PhaseDialog />}
      {editingBudgetLine && <BudgetDialog />}
    </>
  )
}
