import { useRede360Store } from '@/store/rede360Store'
import { Rede360Header } from './components/Rede360Header'
import { MapaOperacionalPanel } from './components/MapaOperacionalPanel'
import { GridBottomPanel } from './components/GridBottomPanel'
import { LiveOutagePanel } from './components/LiveOutagePanel'
import { OrdensServicoPanel } from './components/OrdensServicoPanel'
import { RiscoPanel } from './components/RiscoPanel'

function HomeTabLayout() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <MapaOperacionalPanel />
      </div>
      <GridBottomPanel />
    </div>
  )
}

export function Rede360Page() {
  const activeTab = useRede360Store((s) => s.activeTab)
  return (
    <div className="flex flex-col h-full">
      <Rede360Header />
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'home'     && <HomeTabLayout />}
        {activeTab === 'outages'  && <LiveOutagePanel />}
        {activeTab === 'planning' && <OrdensServicoPanel />}
        {activeTab === 'risk'     && <RiscoPanel />}
      </div>
    </div>
  )
}
