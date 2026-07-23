/**
 * Torre de Controle — COMMAND CENTER da Operação 1500 (Boi Malhado).
 *
 * Topo: sala de comando com dado 100% real do Supabase (campanha, missão da
 * semana, tiles densos, encarregados, feed de apontamentos) — ver
 * components/CommandCenter.tsx.
 *
 * Base: os painéis originais de obras (lista/mapa/detalhe), preservados —
 * carregam do projectContext/Supabase (dado real do projeto).
 */
import { useEffect, useState } from 'react'
import { useProjectContext } from '@/store/projectContext'
import { useTorreStore } from '@/store/torreDeControleStore'
import { CommandCenter } from './components/CommandCenter'
import { ObrasListPanel } from './components/ObrasListPanel'
import { ObrasMap } from './components/ObrasMap'
import { ObraDetailPanel } from './components/ObraDetailPanel'
import { ObraDialog } from './components/ObraDialog'
import { RiskDialog } from './components/RiskDialog'

type MobileTab = 'lista' | 'mapa' | 'detalhes'

const MOBILE_TABS: { key: MobileTab; label: string }[] = [
  { key: 'lista',    label: 'Lista' },
  { key: 'mapa',     label: 'Mapa' },
  { key: 'detalhes', label: 'Detalhes' },
]

export function TorreDeControlePage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('lista')
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const projetos = useProjectContext((s) => s.projetos)
  const loadFromProjectContext = useTorreStore((s) => s.loadFromProjectContext)

  useEffect(() => {
    loadFromProjectContext()
  }, [loadFromProjectContext, activeProjectId, projetos.length])

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0a0f1a]">
      {/* ── COMMAND CENTER (dado real Supabase) ─────────────────────────── */}
      <CommandCenter />

      {/* ── OBRAS · MAPA · DETALHE (painéis originais preservados) ──────── */}
      <div className="shrink-0 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e293b] bg-[#0a0f1a]">
          <span className="inline-block w-2 h-2 bg-[#22c55e]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Obras · Mapa · Riscos — cadastro real do projeto
          </span>
        </div>

        {/* Mobile tab switcher — only visible on small screens */}
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

        {/* Desktop: all three panels side-by-side */}
        {/* Mobile: only the active panel */}
        <div className="flex h-[560px] overflow-hidden">
          <div className={`${mobileTab === 'lista' ? 'flex flex-1 lg:flex-initial' : 'hidden'} lg:flex flex-col`}>
            <ObrasListPanel />
          </div>
          <div className={`${mobileTab === 'mapa' ? 'flex flex-1' : 'hidden'} lg:flex lg:flex-1`}>
            <ObrasMap />
          </div>
          <div className={`${mobileTab === 'detalhes' ? 'flex flex-1' : 'hidden'} lg:flex flex-col`}>
            <ObraDetailPanel />
          </div>
        </div>
      </div>

      <ObraDialog />
      <RiskDialog />
    </div>
  )
}
