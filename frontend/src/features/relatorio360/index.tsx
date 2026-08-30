import { useState } from 'react'
import { AlertTriangle, BarChart3, LayoutDashboard, Target } from 'lucide-react'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { useProjectContext } from '@/store/projectContext'
import { useRelatorio360Real } from '@/hooks/useRelatorio360Real'
import { useMetasProducao } from '@/hooks/useMetasProducao'
import { ReportHeader } from './components/ReportHeader'
import { SummaryRow } from './components/SummaryRow'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { CrewsPanel } from './components/CrewsPanel'
import { EquipmentPanel } from './components/EquipmentPanel'
import { MaterialsPanel } from './components/MaterialsPanel'
import { PhotosPanel } from './components/PhotosPanel'
import { LpsPccPanel } from './components/LpsPccPanel'
import { ResumoPeriodoPanel } from './components/ResumoPeriodoPanel'
import { ProdutividadePanel } from './components/ProdutividadePanel'
import { MetaProgressoPanel } from './components/MetaProgressoPanel'

type TabId = 'diario' | 'periodo' | 'meta'

const TABS: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'diario', label: 'Diário', icon: LayoutDashboard },
  { id: 'periodo', label: 'Resumo & Produtividade', icon: BarChart3 },
  { id: 'meta', label: 'Meta 30 dias', icon: Target },
]

export function Relatorio360Page() {
  const report = useCurrentReport()
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const [tab, setTab] = useState<TabId>('diario')

  const {
    linhas: linhasProducao,
    loading: prodLoading,
    temDadoReal,
    periodoInicio,
    periodoFim,
    setPeriodoInicio,
    setPeriodoFim,
    linhasNoPeriodo,
    resumoPeriodo,
    produtividadeEquipe,
    produtividadeNucleo,
  } = useRelatorio360Real(activeProjectId)

  const {
    metas,
    loading: metasLoading,
    error: metasError,
    adicionarMeta,
    removerMeta,
  } = useMetasProducao(activeProjectId)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Kanban/Equipes/Fotos ainda usam dados mock (src/data/mockRelatorio360.ts).
          O banner some assim que houver produção real (`producao_diaria`) lançada
          para esta obra — nesse caso o aviso passa a viver dentro de cada painel
          que ainda é mock, e Resumo/Produtividade (aba ao lado) já são reais. */}
      {!temDadoReal && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-900/20 border-b border-amber-700/30 text-[10px] text-amber-300">
          <AlertTriangle size={11} className="shrink-0" />
          <span>
            DADOS DE DEMONSTRAÇÃO — Kanban/Equipes/Fotos ainda não conectados às planilhas reais de RDO. Resumo do
            Período e Produtividade (aba ao lado) ficam disponíveis assim que houver produção diária lançada nesta
            obra (aba Produção do RDO).
          </span>
        </div>
      )}
      <ReportHeader />

      <nav className="shrink-0 border-b border-[#525252] bg-[#333333] px-6 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              tab === t.id ? 'text-[#f97316] border-[#f97316]' : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {tab === 'diario' ? (
        report ? (
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

              {/* LPS / PPC / Previsto × Realizado */}
              <section>
                <LpsPccPanel />
              </section>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-[#6b6b6b] text-sm">Nenhum relatório encontrado para esta data.</p>
            <p className="text-[#3f3f3f] text-xs">Use as setas para navegar entre os dias.</p>
          </div>
        )
      ) : tab === 'periodo' ? (
        <div className="flex flex-col gap-6 px-6 py-6">
          <ResumoPeriodoPanel
            resumo={resumoPeriodo}
            periodoInicio={periodoInicio}
            periodoFim={periodoFim}
            onChangeInicio={setPeriodoInicio}
            onChangeFim={setPeriodoFim}
            loading={prodLoading}
            temRegistrosNoPeriodo={linhasNoPeriodo.length > 0}
          />
          <ProdutividadePanel porEquipe={produtividadeEquipe} porNucleo={produtividadeNucleo} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-6 py-6">
          <MetaProgressoPanel
            metas={metas}
            loading={metasLoading}
            error={metasError}
            onAdicionar={adicionarMeta}
            onRemover={removerMeta}
            producaoRows={linhasProducao}
          />
        </div>
      )}
    </div>
  )
}
