import { useState } from 'react'
import { GestaoHeader }      from './components/GestaoHeader'
import { FleetDashboard }    from './components/FleetDashboard'
import { MaintenancePanel }  from './components/MaintenancePanel'
import { UtilizacaoPanel }   from './components/UtilizacaoPanel'
import { CustosPanel }       from './components/CustosPanel'
import { EquipamentosPage }  from '@/features/equipamentos/index'

export function GestaoEquipamentosPage() {
  const [activeTab, setActiveTab] = useState('equipamentos')

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#333333]">
      <GestaoHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-hidden">
        {activeTab === 'equipamentos' && <EquipamentosPage />}
        {activeTab === 'dashboard'    && <FleetDashboard />}
        {activeTab === 'manutencoes'  && <MaintenancePanel />}
        {activeTab === 'utilizacao'   && <UtilizacaoPanel />}
        {activeTab === 'custos'       && <CustosPanel />}
      </div>
    </div>
  )
}
